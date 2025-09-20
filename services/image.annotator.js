// image.annotator.js

import sharp from 'sharp';

/**
 * Generates the SVG string for a single tick/cross mark AND its corresponding question letter.
 * @param {object} annotation - The annotation object.
 * @returns {string} - The SVG element as a string.
 */
function generateSvgElement(annotation) {
    const { x, y } = annotation.placement_coordinate;
    const markSize = 40; // Slightly smaller to make room for text
    const textFontSize = 32;
    let elements = '';
    
    // SVG group for the mark (tick or cross)
    let markSvg = '';
    // SVG for the text label (e.g., "A", "B")
    let textSvg = '';

    // The transform for centering the icon on the (x, y) coordinate
    const transform = `transform="translate(${x}, ${y}) translate(-${markSize / 2}, -${markSize / 2}) scale(${markSize / 24})"`;

    switch (annotation.mark_type) {
        case 'tick': {
            markSvg = `
                <g ${transform}>
                    <path fill="none" stroke="green" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/>
                </g>
            `;
            break;
        }
        case 'cross': {
            markSvg = `
                <g ${transform}>
                    <path fill="none" stroke="red" stroke-width="2.5" stroke-linecap="round" d="M18 6L6 18M6 6l12 12"/>
                </g>
            `;
            break;
        }
    }

    // Create the text label for the question part
    // Position it to the left of the mark's center point
    const textX = x - markSize; 
    const textY = y + (textFontSize / 3); // Adjust for vertical alignment
    textSvg = `
        <text x="${textX}" y="${textY}" font-family="Arial, sans-serif" font-size="${textFontSize}px" fill="blue" font-weight="bold">
            (${annotation.question_part})
        </text>
    `;

    // Combine the text and the mark
    elements = textSvg + markSvg;
    return elements;
}


/**
 * Annotates an image buffer based on a list of annotations.
 * @param {Buffer} imageBuffer - The original image buffer.
 * @param {Array} annotations - The list of annotations for this specific image.
 * @returns {Promise<Buffer>} - The buffer of the annotated image.
 */
export async function annotateImage(imageBuffer, annotations) {
    if (!annotations || annotations.length === 0) {
        return imageBuffer; // Return original if no changes
    }
    
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const svgElements = annotations.map(generateSvgElement).join('');

    const fullOverlaySvg = `
        <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
            ${svgElements}
        </svg>
    `;

    const overlayBuffer = Buffer.from(fullOverlaySvg);
    
    return image
        .composite([{ 
            input: overlayBuffer, 
            top: 0, 
            left: 0 
        }])
        .toBuffer();
}