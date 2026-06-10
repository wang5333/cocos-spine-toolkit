import { _decorator, Component, Texture2D, SpriteFrame, sp } from 'cc';
const { ccclass, property } = _decorator;

/**
Helper component to simplify dynamic clothing/attachments and texture swapping in Spine at runtime.
Works directly with the Cocos Creator 3.x Spine Runtime.
*/
@ccclass('SpineAttachmentHelper')
export class SpineAttachmentHelper extends Component {
    private _skeleton: sp.Skeleton = null!;

    start() {
        this._skeleton = this.getComponent(sp.Skeleton)!;
    }

    /**
     * Swaps the active attachment in a slot using the slot and attachment name defined in the Spine editor.
     * @param slotName Name of the Spine slot
     * @param attachmentName Name of the attachment inside that slot
     */
    public setAttachment(slotName: string, attachmentName: string | null): boolean {
        if (!this._skeleton || !this._skeleton.skeleton) {
            console.warn('[SpineAttachmentHelper] Skeleton not ready or not found.');
            return false;
        }

        const slot = this._skeleton.skeleton.findSlot(slotName);
        if (!slot) {
            console.warn(`[SpineAttachmentHelper] Slot not found: ${slotName}`);
            return false;
        }

        if (!attachmentName) {
            slot.setAttachment(null);
            return true;
        }

        const attachment = this._skeleton.skeleton.getAttachmentByName(slotName, attachmentName);
        if (!attachment) {
            console.warn(`[SpineAttachmentHelper] Attachment ${attachmentName} not found in slot ${slotName}`);
            return false;
        }

        slot.setAttachment(attachment);
        return true;
    }

    /**
     * Procedurally replaces a slot's attachment with a dynamic Cocos Texture2D at runtime.
     * Useful for user-generated content (UGC), dynamic weapon skins, or avatars.
     * 
     * @param slotName Name of the slot to replace
     * @param texture The Cocos Texture2D to apply
     * @param width Display width of the new attachment (defaults to texture width if not specified)
     * @param height Display height of the new attachment (defaults to texture height if not specified)
     * @param attachmentName Optional custom name for the dynamic attachment
     */
    public setSlotTexture(
        slotName: string, 
        texture: Texture2D, 
        width?: number, 
        height?: number, 
        attachmentName: string = "dynamic_attachment"
    ): boolean {
        if (!this._skeleton || !this._skeleton.skeleton) return false;

        const slot = this._skeleton.skeleton.findSlot(slotName);
        if (!slot) {
            console.warn(`[SpineAttachmentHelper] Slot not found: ${slotName}`);
            return false;
        }

        const w = width ?? texture.width;
        const h = height ?? texture.height;

        // In Cocos Creator 3.x, the Spine runtime assembler binds textures from the AtlasPage.
        // We instantiate a custom TextureAtlasPage and TextureAtlasRegion.
        const page = new sp.spine.TextureAtlasPage();
        page.name = attachmentName;
        
        // Wrap the Cocos texture. Cocos Creator assembler maps the page's rendererObject (which is a texture) to GL texture units.
        page.rendererObject = texture;

        const region = new sp.spine.TextureAtlasRegion();
        region.page = page;
        region.width = texture.width;
        region.height = texture.height;
        region.originalWidth = texture.width;
        region.originalHeight = texture.height;
        
        // Map full UV coordinates (0,0 to 1,1)
        region.u = 0;
        region.v = 0;
        region.u2 = 1;
        region.v2 = 1;

        // Create a new RegionAttachment
        const attachment = new sp.spine.RegionAttachment(attachmentName);
        attachment.rendererObject = region;
        attachment.setUVs(region.u, region.v, region.u2, region.v2, false);

        attachment.width = w;
        attachment.height = h;
        attachment.x = 0;
        attachment.y = 0;
        attachment.scaleX = 1;
        attachment.scaleY = 1;
        attachment.rotation = 0;
        attachment.updateOffset();

        // Apply it to the slot
        slot.setAttachment(attachment);
        return true;
    }

    /**
     * Procedurally replaces a slot's attachment with a dynamic Cocos SpriteFrame.
     * Correctly handles texture sheets / packed sprite atlas offsets.
     */
    public setSlotSpriteFrame(
        slotName: string, 
        spriteFrame: SpriteFrame, 
        width?: number, 
        height?: number,
        attachmentName: string = "dynamic_spriteframe"
    ): boolean {
        const texture = spriteFrame.texture as Texture2D;
        if (!texture) {
            console.warn('[SpineAttachmentHelper] SpriteFrame has no texture.');
            return false;
        }

        if (!this._skeleton || !this._skeleton.skeleton) return false;
        const slot = this._skeleton.skeleton.findSlot(slotName);
        if (!slot) return false;

        const rect = spriteFrame.rect;
        const texWidth = texture.width;
        const texHeight = texture.height;

        const w = width ?? rect.width;
        const h = height ?? rect.height;

        const page = new sp.spine.TextureAtlasPage();
        page.name = attachmentName;
        page.rendererObject = texture;

        const region = new sp.spine.TextureAtlasRegion();
        region.page = page;
        region.width = rect.width;
        region.height = rect.height;
        region.originalWidth = rect.width;
        region.originalHeight = rect.height;

        // Calculate specific UV coordinates inside the packed atlas
        region.u = rect.x / texWidth;
        region.v = rect.y / texHeight;
        region.u2 = (rect.x + rect.width) / texWidth;
        region.v2 = (rect.y + rect.height) / texHeight;

        const attachment = new sp.spine.RegionAttachment(attachmentName);
        attachment.rendererObject = region;
        attachment.setUVs(region.u, region.v, region.u2, region.v2, spriteFrame.isRotated());

        attachment.width = w;
        attachment.height = h;
        attachment.x = 0;
        attachment.y = 0;
        attachment.scaleX = 1;
        attachment.scaleY = 1;
        attachment.rotation = 0;
        attachment.updateOffset();

        slot.setAttachment(attachment);
        return true;
    }
}
