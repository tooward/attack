// filepath: /Users/mike/Development/attack/src/utils/SpriteUtils.ts
import { Scene, GameObjects, Physics, Textures } from 'phaser';

/**
 * Utility class for sprite-related operations
 */
export default class SpriteUtils {
    /**
     * Adjust the physics body of a sprite to tightly fit around non-transparent pixels
     * @param scene The current scene
     * @param sprite The sprite to adjust
     * @param padding Optional padding to add around the trimmed body (default: 0)
     * @param debug Whether to show debug visualization of the trimmed body (default: false)
     * @returns The original sprite with adjusted physics body
     */
    static trimBodyToSprite(
        scene: Scene, 
        sprite: Physics.Arcade.Sprite, 
        padding: number = 0, 
        debug: boolean = false
    ): Physics.Arcade.Sprite {
        // Get current frame and texture data
        const frame = sprite.frame;
        if (!frame) {
            console.warn('Cannot trim body: sprite has no frame');
            return sprite;
        }

        // Get the texture to analyze
        const textureManager = scene.textures;
        const frameName = frame.name;
        const textureKey = frame.texture.key;
        
        // Use Phaser's getPixelAlpha to determine the bounding box
        const frameWidth = frame.width;
        const frameHeight = frame.height;
        
        // Variables to track the bounds of non-transparent pixels
        let left = frameWidth;
        let right = 0;
        let top = frameHeight;
        let bottom = 0;
        let found = false;
        
        // Loop through all pixels in the texture
        for (let y = 0; y < frameHeight; y++) {
            for (let x = 0; x < frameWidth; x++) {
                // Get alpha value at this position
                const alpha = textureManager.getPixelAlpha(x, y, textureKey, frameName);
                
                // If pixel is not transparent (alpha > 0), update bounds
                if (alpha && alpha > 0) {
                    found = true;
                    left = Math.min(left, x);
                    right = Math.max(right, x);
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                }
            }
        }
        
        // If no non-transparent pixels were found, use the full frame
        if (!found) {
            console.warn('No non-transparent pixels found in sprite');
            return sprite;
        }
        
        // Apply padding
        left = Math.max(0, left - padding);
        top = Math.max(0, top - padding);
        right = Math.min(frameWidth - 1, right + padding);
        bottom = Math.min(frameHeight - 1, bottom + padding);
        
        // Calculate new body dimensions
        const bodyWidth = right - left + 1;
        const bodyHeight = bottom - top + 1;
        
        // Only proceed if we have a valid body
        if (bodyWidth <= 0 || bodyHeight <= 0) {
            console.warn('Calculated body has invalid dimensions, using original sprite size');
            return sprite;
        }
        
        // Ensure sprite has an active physics body
        if (!sprite.body) {
            console.warn('Sprite has no physics body to adjust');
            return sprite;
        }
        
        // Record sprite's flipX state
        const isFlipped = sprite.flipX;
        
        // Apply the new body size and calculate the offset correctly
        const body = sprite.body as Physics.Arcade.Body;
        body.setSize(bodyWidth, bodyHeight);
        
        // Calculate offsets for non-flipped state
        const leftOffset = left;
        const rightOffset = frameWidth - right - 1;
        
        // Calculate vertical offset
        // Use a fixed offset from the top rather than trying to center
        // This approach better preserves the character's ground position
        const topOffset = top;
        
        // Apply the appropriate offset based on current flip state
        body.setOffset(isFlipped ? rightOffset : leftOffset, topOffset);

        // Store offsets on the sprite for flip handling
        sprite.setData('leftOffset', leftOffset);
        sprite.setData('rightOffset', rightOffset);
        sprite.setData('topOffset', topOffset);
        
        // Store current flip state
        sprite.setData('lastFlipX', isFlipped);
        
        if (debug) {
            // Store debug visualization function as data on the sprite
            sprite.setData('showDebugHitbox', () => {
                // Safety check - make sure sprite and body still exist
                if (!sprite || !sprite.active || !sprite.body) {
                    return;
                }
                
                const debugGraphics = scene.add.graphics();
                debugGraphics.lineStyle(2, 0xff0000, 1);
                
                try {
                    // Make sure the body is still valid and enabled
                    if (!body.enable || body.debugShowBody === false) {
                        return;
                    }
                    
                    // Get the body's position in world space - create a custom bounds object
                    // instead of relying on body.getBounds() which can throw errors
                    const bodyBounds = {
                        x: body.position.x,
                        y: body.position.y,
                        width: body.width,
                        height: body.height
                    };
                    
                    // Draw rectangle at the correct position
                    debugGraphics.strokeRect(
                        bodyBounds.x, 
                        bodyBounds.y, 
                        bodyBounds.width, 
                        bodyBounds.height
                    );
                    
                    // Add text showing boundaries
                    const debugText = scene.add.text(
                        sprite.x, 
                        sprite.y - 40, 
                        `Body: ${bodyWidth}x${bodyHeight}, Offset: (${body.offset.x},${body.offset.y})`,
                        { fontSize: '12px', color: '#ff0000', backgroundColor: '#0000' }
                    ).setOrigin(0.5, 0).setDepth(100);
                    
                    // Remove debug visualization after 3 seconds
                    scene.time.delayedCall(3000, () => {
                        debugGraphics.destroy();
                        if (debugText && debugText.active) {
                            debugText.destroy();
                        }
                    });
                } catch (error) {
                    console.warn('Error drawing debug hitbox:', error);
                    debugGraphics.destroy();
                }
            });
        }
        
        return sprite;
    }
}