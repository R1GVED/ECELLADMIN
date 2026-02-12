import React, { useRef, useEffect } from 'react';

export default function CertificateCanvas({
    templateUrl,
    fields = [],
    data = {},
    width = 800,
    height = 600,
    className = "",
    scale = 1
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw Background Image
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = templateUrl;

        img.onload = () => {
            // Draw image to fit canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Draw Fields
            fields.forEach(field => {
                const text = data[field.key] || field.label || "Sample Text";

                ctx.font = `${field.fontWeight || 'normal'} ${field.fontSize || 20}px ${field.fontFamily || 'Arial'}`;
                ctx.fillStyle = field.color || '#000000';
                ctx.textAlign = field.textAlign || 'center';
                ctx.textBaseline = 'middle';

                // Calculate position based on percentage if stored that way, or raw pixels
                // Assuming raw pixels for simplicty in Admin, but maybe percentage is better for responsiveness?
                // Let's stick to the coordinate system of the canvas (width/height)

                ctx.fillText(text, field.x, field.y);
            });
        };

    }, [templateUrl, fields, data, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`shadow-lg border border-slate-700 ${className}`}
            style={{
                width: width * scale,
                height: height * scale
            }}
        />
    );
}
