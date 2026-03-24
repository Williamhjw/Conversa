const axios = require("axios");
const { GLM_API_KEY, AMAP_API_KEY } = require("../secrets.js");

const windPowerToSpeed = (windPower) => {
    if (!windPower) return 0;
    
    const match = windPower.toString().match(/\d+/);
    if (!match) return 0;
    
    const power = parseInt(match[0]);
    const windSpeedMap = {
        0: 0,
        1: 0.9,
        2: 2.4,
        3: 4.4,
        4: 6.7,
        5: 9.4,
        6: 12.3,
        7: 15.5,
        8: 18.9,
        9: 22.6,
        10: 26.4,
        11: 30.5,
        12: 34.8
    };
    return windSpeedMap[power] || 0;
};

const estimateVisibility = (weather, humidity) => {
    const weatherStr = (weather || "").toLowerCase();
    const hum = parseInt(humidity) || 50;
    
    if (weatherStr.includes("雾") || weatherStr.includes("霾")) {
        if (weatherStr.includes("大雾") || weatherStr.includes("浓雾") || weatherStr.includes("强霾")) {
            return 0.5;
        }
        return 2;
    }
    if (weatherStr.includes("暴雨") || weatherStr.includes("大暴雨")) {
        return 1;
    }
    if (weatherStr.includes("大雨") || weatherStr.includes("雪")) {
        return 3;
    }
    if (weatherStr.includes("中雨") || weatherStr.includes("沙尘")) {
        return 5;
    }
    if (weatherStr.includes("小雨") || weatherStr.includes("阵雨")) {
        return 8;
    }
    if (weatherStr.includes("多云") || weatherStr.includes("阴")) {
        if (hum > 80) return 8;
        return 12;
    }
    if (weatherStr.includes("晴")) {
        if (hum > 80) return 10;
        return 15;
    }
    return 10;
};

const estimatePressure = (temperature, humidity) => {
    const temp = parseFloat(temperature) || 20;
    const hum = parseFloat(humidity) || 50;
    
    let basePressure = 1013;
    
    if (temp > 30) {
        basePressure = 1008 + Math.random() * 5;
    } else if (temp < 5) {
        basePressure = 1020 + Math.random() * 10;
    } else {
        basePressure = 1013 + (Math.random() - 0.5) * 10;
    }
    
    if (hum > 80) {
        basePressure -= 2;
    }
    
    return Math.round(basePressure);
};

const getWeather = async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: "需要提供经纬度" });
        }

        if (!AMAP_API_KEY) {
            return res.status(500).json({ error: "天气服务未配置" });
        }

        console.log("Fetching weather for:", { lat, lon });

        const geoUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_API_KEY}&location=${lon},${lat}&extensions=base`;
        
        const geoResponse = await axios.get(geoUrl);
        const geoData = geoResponse.data;

        console.log("Geocode response:", geoData);

        if (geoData.status !== "1") {
            console.error("Geocode API error:", geoData);
            return res.status(500).json({ error: "无法获取位置信息" });
        }

        const cityCode = geoData.regeocode?.addressComponent?.adcode;
        const cityName = geoData.regeocode?.addressComponent?.city || geoData.regeocode?.formatted_address;

        console.log("City info:", { cityCode, cityName });

        if (!cityCode) {
            return res.status(500).json({ error: "无法获取城市信息" });
        }

        const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_API_KEY}&city=${cityCode}&extensions=base`;

        const response = await axios.get(weatherUrl);
        const data = response.data;

        console.log("AMap weather response:", JSON.stringify(data, null, 2));

        if (data.status !== "1") {
            console.error("AMap API error:", data);
            return res.status(500).json({ error: data.info || "获取天气信息失败" });
        }

        const lives = data.lives?.[0] || {};

        console.log("Parsed data:", { lives });

        const weatherData = {
            location: lives.city || cityName || "当前位置",
            temperature: parseFloat(lives.temperature) || 0,
            feelsLike: parseFloat(lives.temperature) || 0,
            humidity: parseInt(lives.humidity) || 0,
            windSpeed: windPowerToSpeed(lives.windpower),
            windDirection: lives.winddirection || "无",
            description: lives.weather || "未知",
            icon: lives.weather || "晴",
            visibility: estimateVisibility(lives.weather, lives.humidity) * 1000,
            pressure: estimatePressure(lives.temperature, lives.humidity),
        };

        console.log("Final weather data:", weatherData);
        res.json(weatherData);
    } catch (error) {
        console.error("Weather API error:", error.message);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: "获取天气信息失败: " + error.message });
    }
};

const getSuggestion = async (req, res) => {
    try {
        const { temperature, feelsLike, humidity, windSpeed, description, location } = req.body;

        if (!GLM_API_KEY) {
            return res.json({
                clothing: "AI服务暂未配置，无法提供穿衣建议。",
                travel: "AI服务暂未配置，无法提供出行提醒。"
            });
        }

        const prompt = `你是一位专业的生活顾问和气象专家。请根据以下详细的天气信息，为用户提供全面、实用、贴心的穿衣建议和出行提醒。

【天气信息】
📍 当前位置：${location || "未知"}
🌡️ 当前温度：${temperature}°C
🤔 体感温度：${feelsLike}°C
💧 相对湿度：${humidity}%
💨 风速：${windSpeed} m/s
🌤️ 天气状况：${description}

【分析维度】
1. 温度分析：根据实际温度和体感温度的差异，分析人体舒适度
2. 湿度影响：考虑湿度对体感温度和衣物选择的影响
3. 风力因素：分析风速对体感温度和出行的影响
4. 天气状况：结合具体天气现象给出针对性建议

【输出要求】
请用中文回答，分为两个部分：

👔 穿衣建议：
- 上装推荐（具体衣物类型和材质）
- 下装推荐
- 外套/配饰建议（如需要）
- 特殊人群注意事项（老人、儿童、体弱者）
- 总体穿衣原则总结

🚗 出行提醒：
- 交通方式建议
- 户外活动适宜度
- 需要携带的物品
- 安全注意事项
- 特殊天气应对措施

请给出详细、具体、可操作的建议，让用户能够根据建议做出正确的决策。字数可以适当增加，确保信息完整。`;

        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GLM_API_KEY}`,
            },
            body: JSON.stringify({
                model: "glm-4.5-air",
                messages: [
                    {
                        role: "system",
                        content: "你是一位专业的生活顾问，擅长根据天气条件给出详细实用的建议。你的建议应该具体、可操作、考虑周全。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("GLM API error:", errorText);
            return res.json({
                clothing: generateDefaultClothingSuggestion(temperature, feelsLike, humidity, windSpeed, description),
                travel: generateDefaultTravelSuggestion(temperature, feelsLike, humidity, windSpeed, description)
            });
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";

        // Parse the response to extract clothing and travel suggestions
        const clothingMatch = text.match(/👔\s*穿衣建议[：:]?\s*([\s\S]*?)(?=🚗|$)/);
        const travelMatch = text.match(/🚗\s*出行提醒[：:]?\s*([\s\S]*?)$/);

        let clothing = clothingMatch ? clothingMatch[1].trim() : "";
        let travel = travelMatch ? travelMatch[1].trim() : "";

        // If parsing fails, use default suggestions
        if (!clothing) {
            clothing = generateDefaultClothingSuggestion(temperature, feelsLike, humidity, windSpeed, description);
        }
        if (!travel) {
            travel = generateDefaultTravelSuggestion(temperature, feelsLike, humidity, windSpeed, description);
        }

        res.json({ clothing, travel });
    } catch (error) {
        console.error("AI suggestion error:", error.message);
        res.json({
            clothing: generateDefaultClothingSuggestion(temperature, feelsLike, humidity, windSpeed, description),
            travel: generateDefaultTravelSuggestion(temperature, feelsLike, humidity, windSpeed, description)
        });
    }
};

// Helper function to generate default clothing suggestion
const generateDefaultClothingSuggestion = (temperature, feelsLike, humidity, windSpeed, description) => {
    const temp = parseFloat(temperature);
    const feelTemp = parseFloat(feelsLike);
    const hum = parseFloat(humidity);
    const wind = parseFloat(windSpeed);
    
    let suggestion = "";
    
    // Temperature-based recommendations
    if (feelTemp >= 30) {
        suggestion = "🌡️ 炎热天气穿衣建议\n\n";
        suggestion += "上装：选择轻薄透气的棉质或亚麻材质短袖、背心，浅色系更佳，有助于反射阳光。\n\n";
        suggestion += "下装：短裤、薄款长裤或裙装，避免紧身衣物。\n\n";
        suggestion += "配饰：佩戴遮阳帽、太阳镜，使用防晒霜（SPF30+）。\n\n";
        suggestion += "特殊注意：老人、儿童和体弱者应避免正午外出，多补充水分。\n\n";
        suggestion += "总体原则：轻薄、透气、浅色、宽松，优先选择天然纤维材质。";
    } else if (feelTemp >= 25) {
        suggestion = "🌤️ 温暖天气穿衣建议\n\n";
        suggestion += "上装：短袖T恤、薄款衬衫或Polo衫，棉质或混纺材质。\n\n";
        suggestion += "下装：休闲裤、牛仔裤或轻薄长裙。\n\n";
        suggestion += "外套：可准备一件薄外套或开衫，应对空调环境或傍晚降温。\n\n";
        suggestion += "配饰：轻便遮阳帽，舒适透气的鞋子。\n\n";
        suggestion += "总体原则：舒适透气，方便穿脱，适应温差变化。";
    } else if (feelTemp >= 15) {
        suggestion = "🍃 凉爽天气穿衣建议\n\n";
        suggestion += "上装：长袖T恤、薄毛衣或卫衣，可搭配轻薄外套。\n\n";
        suggestion += "下装：长裤或厚款裙装，避免短裤。\n\n";
        suggestion += "外套：风衣、薄夹克或针织开衫，方便随时穿脱。\n\n";
        suggestion += "配饰：薄围巾（防风），舒适的平底鞋或运动鞋。\n\n";
        suggestion += "总体原则：层次穿搭，方便根据温度变化调整。";
    } else if (feelTemp >= 5) {
        suggestion = "❄️ 寒冷天气穿衣建议\n\n";
        suggestion += "上装：保暖内衣+毛衣/卫衣+厚外套（羽绒服、棉服或毛呢大衣）。\n\n";
        suggestion += "下装：保暖裤或厚款长裤，必要时加穿秋裤。\n\n";
        suggestion += "外套：中厚款羽绒服、棉服或毛呢外套。\n\n";
        suggestion += "配饰：围巾、手套、帽子，保暖防滑的鞋子。\n\n";
        suggestion += "特殊注意：老人、儿童注意保暖，避免长时间户外活动。\n\n";
        suggestion += "总体原则：多层保暖，重点保护头部、颈部和四肢。";
    } else {
        suggestion = "🥶 严寒天气穿衣建议\n\n";
        suggestion += "上装：保暖内衣+抓绒衣/厚毛衣+厚羽绒服或棉服。\n\n";
        suggestion += "下装：保暖裤+厚外裤，或加绒裤装。\n\n";
        suggestion += "外套：长款厚羽绒服或专业防寒服。\n\n";
        suggestion += "配饰：厚围巾、保暖手套、毛线帽、口罩，防滑保暖靴。\n\n";
        suggestion += "特殊注意：尽量减少户外停留时间，注意防冻伤。\n\n";
        suggestion += "总体原则：最大限度保暖，避免皮肤暴露在外。";
    }
    
    // Add humidity and wind considerations
    if (hum > 80) {
        suggestion += "\n\n💧 湿度提示：湿度较高，体感可能更闷热，建议选择吸湿排汗的材质。";
    }
    if (wind > 5) {
        suggestion += "\n\n💨 风力提示：风力较大，建议增加防风外套，注意保护头部。";
    }
    
    return suggestion;
};

// Helper function to generate default travel suggestion
const generateDefaultTravelSuggestion = (temperature, feelsLike, humidity, windSpeed, description) => {
    const temp = parseFloat(temperature);
    const feelTemp = parseFloat(feelsLike);
    const hum = parseFloat(humidity);
    const wind = parseFloat(windSpeed);
    const weather = description || "";
    
    let suggestion = "";
    
    // Weather condition-based recommendations
    if (weather.includes("雨") || weather.includes("Rain")) {
        suggestion = "🌧️ 雨天出行提醒\n\n";
        suggestion += "交通方式：优先选择地铁、公交等公共交通，驾车注意减速慢行，保持安全车距。\n\n";
        suggestion += "户外活动：不建议户外长时间活动，如需外出请携带雨具。\n\n";
        suggestion += "携带物品：雨伞/雨衣、防水鞋套、防水袋（保护电子设备）。\n\n";
        suggestion += "安全注意：避开积水路段，注意防滑，雷电天气避免树下避雨。\n\n";
        suggestion += "应对措施：关注天气预报，合理安排出行时间，预留充足时间。";
    } else if (weather.includes("雪") || weather.includes("Snow")) {
        suggestion = "❄️ 雪天出行提醒\n\n";
        suggestion += "交通方式：建议乘坐公共交通，驾车需安装防滑链，保持低速行驶。\n\n";
        suggestion += "户外活动：减少不必要的外出，外出注意防寒防滑。\n\n";
        suggestion += "携带物品：防滑鞋、保暖手套、围巾、热饮保温杯。\n\n";
        suggestion += "安全注意：注意路面结冰，上下楼梯扶好扶手，老人儿童需陪同。\n\n";
        suggestion += "应对措施：提前了解路况，穿着防滑鞋，注意保暖。";
    } else if (weather.includes("雾") || weather.includes("霾") || weather.includes("Fog") || weather.includes("Haze")) {
        suggestion = "🌫️ 雾霾天气出行提醒\n\n";
        suggestion += "交通方式：驾车开启雾灯，减速慢行，保持更大安全距离。\n\n";
        suggestion += "户外活动：减少户外剧烈运动，敏感人群避免外出。\n\n";
        suggestion += "携带物品：防霾口罩（N95/KN95）、眼镜/护目镜。\n\n";
        suggestion += "安全注意：能见度低，注意交通安全，避免前往山区。\n\n";
        suggestion += "应对措施：关注空气质量指数，必要时推迟出行计划。";
    } else if (feelTemp >= 35) {
        suggestion = "🌡️ 高温天气出行提醒\n\n";
        suggestion += "交通方式：优先选择空调交通工具，避免正午时段骑行或步行。\n\n";
        suggestion += "户外活动：避免10:00-16:00高温时段户外活动，选择早晚凉爽时段。\n\n";
        suggestion += "携带物品：防晒霜、遮阳伞、太阳镜、充足饮用水、清凉油/风油精。\n\n";
        suggestion += "安全注意：注意防暑降温，如出现头晕、恶心等症状立即休息补水。\n\n";
        suggestion += "应对措施：随身携带防暑药品，避免单独在高温环境活动。";
    } else if (wind > 8) {
        suggestion = "💨 大风天气出行提醒\n\n";
        suggestion += "交通方式：驾车注意横风影响，骑行需格外小心，建议乘坐公共交通。\n\n";
        suggestion += "户外活动：避免在高楼、广告牌、大树下停留，减少外出。\n\n";
        suggestion += "携带物品：防风外套、固定好帽子和围巾，避免携带易被吹走的物品。\n\n";
        suggestion += "安全注意：注意高空坠物，远离临时搭建物，保护好眼睛。\n\n";
        suggestion += "应对措施：关注大风预警，必要时推迟出行。";
    } else {
        suggestion = "🚗 日常出行提醒\n\n";
        suggestion += "交通方式：天气适宜，各种交通方式均可选择，驾车注意交通安全。\n\n";
        suggestion += "户外活动：适合户外活动，可根据个人喜好安排运动或休闲。\n\n";
        suggestion += "携带物品：根据温度准备相应衣物，携带手机、钱包等必需品。\n\n";
        suggestion += "安全注意：遵守交通规则，注意个人财物安全。\n\n";
        suggestion += "应对措施：关注天气变化，适时调整出行计划。";
    }
    
    // Add specific recommendations based on conditions
    if (hum > 85) {
        suggestion += "\n\n💧 高湿度提示：体感可能较闷热，注意补充水分，避免中暑。";
    }
    if (feelTemp < 5) {
        suggestion += "\n\n🧊 低温提示：注意车辆预热，电动车电池续航可能受影响。";
    }
    
    return suggestion;
};

module.exports = {
    getWeather,
    getSuggestion
};
