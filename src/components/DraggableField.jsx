import React, { useState, useEffect, useRef } from 'react';

export default function DraggableField({
    field,
    onUpdate,
    containerWidth,
    containerHeight,
    isSelected,
    onSelect
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState({ x: field.x, y: field.y });
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setPos({ x: field.x, y: field.y });
    }, [field.x, field.y]);

    const handleMouseDown = (e) => {
        e.preventDefault(); // Prevent text selection
        e.stopPropagation();
        setIsDragging(true);
        onSelect(field.id);
        dragStart.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        let newX = e.clientX - dragStart.current.x;
        let newY = e.clientY - dragStart.current.y;

        // Boundary checks
        newX = Math.max(0, Math.min(newX, containerWidth));
        newY = Math.max(0, Math.min(newY, containerHeight));

        setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            onUpdate(field.id, { x: pos.x, y: pos.y });
        }
    };

    // Attach global mouse listeners when dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            onMouseDown={handleMouseDown}
            style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -50%)', // Center the anchor point
                cursor: isDragging ? 'grabbing' : 'grab',
                fontFamily: field.fontFamily || 'Arial',
                fontSize: `${field.fontSize}px`,
                fontWeight: field.fontWeight || 'normal',
                color: field.color || '#000',
                border: isSelected ? '2px dashed #6366f1' : '1px dashed transparent', // Indigo highlight
                padding: '4px',
                zIndex: isSelected ? 10 : 1,
                userSelect: 'none',
                whiteSpace: 'nowrap'
            }}
            className="hover:border-slate-400 transition-colors"
        >
            {field.label || "Text Field"}
        </div>
    );
}
