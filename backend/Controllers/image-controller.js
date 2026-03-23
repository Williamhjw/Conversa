const { GLM_API_KEY, IMAGE_GEN_MODEL } = require("../secrets.js");

/**
 * Generate image using CogView-3 model
 * POST /api/image/generate
 */
const generateImage = async (req, res) => {
    try {
        const { prompt, size = "1024x1024", n = 1 } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: '请提供图片描述' });
        }

        if (!GLM_API_KEY) {
            return res.status(500).json({ error: 'AI服务未配置' });
        }

        // Validate size parameter
        const validSizes = ["1024x1024", "768x1344", "864x1152", "1344x768", "1152x864"];
        const imageSize = validSizes.includes(size) ? size : "1024x1024";

        const response = await fetch("https://open.bigmodel.cn/api/paas/v4/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GLM_API_KEY}`,
            },
            body: JSON.stringify({
                model: IMAGE_GEN_MODEL,
                prompt: prompt,
                size: imageSize,
                n: Math.min(Math.max(1, parseInt(n) || 1), 4), // Limit to 1-4 images
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Image generation API error:", errorText);
            return res.status(500).json({ 
                error: '图片生成失败，请稍后重试',
                details: errorText
            });
        }

        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            return res.status(500).json({ error: '图片生成返回数据异常' });
        }

        // Return the generated image URLs
        res.json({
            success: true,
            images: data.data.map(img => ({
                url: img.url,
                revised_prompt: img.revised_prompt || prompt
            })),
            model: IMAGE_GEN_MODEL,
            created: data.created
        });

    } catch (error) {
        console.error("Image generation error:", error.message);
        res.status(500).json({ 
            error: '图片生成服务暂时不可用',
            message: error.message 
        });
    }
};

/**
 * Check if image generation is available
 * GET /api/image/status
 */
const checkImageGenStatus = async (req, res) => {
    res.json({
        available: !!GLM_API_KEY,
        model: IMAGE_GEN_MODEL
    });
};

module.exports = {
    generateImage,
    checkImageGenStatus
};
