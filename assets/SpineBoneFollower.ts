import { _decorator, Component, Node, Vec3, Mat4, sp } from 'cc';
const { ccclass, property } = _decorator;

/**
Synchronizes a Cocos Creator Node's position, rotation, and scale with a specific Spine bone.
Useful for placing UI elements (like HP bars), equipment, or particle effects onto a character's skeleton.
Supports nodes inside or outside the skeleton's local hierarchy.
*/
@ccclass('SpineBoneFollower')
export class SpineBoneFollower extends Component {
    @property({ type: sp.Skeleton, tooltip: 'The Spine Skeleton component to follow' })
    skeleton: sp.Skeleton = null!;

    @property({ tooltip: 'Name of the bone to follow' })
    boneName: string = '';

    @property({ tooltip: 'Follow position' })
    followPosition: boolean = true;

    @property({ tooltip: 'Follow rotation' })
    followRotation: boolean = true;

    @property({ tooltip: 'Follow scale (Warning: scale calculations can be skewed by bone shearing)' })
    followScale: boolean = false;

    @property({ tooltip: 'Offset position in the bone\'s local space' })
    offset: Vec3 = new Vec3(0, 0, 0);

    private _bone: any = null;
    private _skeletonMatrix: Mat4 = new Mat4();
    private _bonePos: Vec3 = new Vec3();
    private _worldBonePos: Vec3 = new Vec3();

    start() {
        if (!this.skeleton) {
            this.skeleton = this.node.parent?.getComponent(sp.Skeleton)!;
        }
        this._initBone();
    }

    private _initBone() {
        if (!this.skeleton || !this.skeleton.skeleton) return;
        this._bone = this.skeleton.skeleton.findBone(this.boneName);
        if (!this._bone) {
            console.warn(`[SpineBoneFollower] Bone not found: ${this.boneName}`);
        }
    }

    lateUpdate() {
        if (!this.skeleton || !this._bone) return;

        // Re-initialize bone if loaded late
        if (!this._bone.matrix) {
            this._initBone();
            if (!this._bone) return;
        }

        const bone = this._bone;
        const skeletonNode = this.skeleton.node;

        // Bone local space coordinates with offset
        // bone.worldX and bone.worldY are in the skeleton's local space
        this._bonePos.set(bone.worldX + this.offset.x, bone.worldY + this.offset.y, this.offset.z);

        // Convert skeleton local coordinates to world coordinates
        skeletonNode.getWorldMatrix(this._skeletonMatrix);
        Vec3.transformMat4(this._worldBonePos, this._bonePos, this._skeletonMatrix);

        // 1. Synchronize Position
        if (this.followPosition) {
            // Convert world coordinates to follower node's parent space
            if (this.node.parent) {
                const localPos = new Vec3();
                this.node.parent.inverseTransformPoint(localPos, this._worldBonePos);
                this.node.setPosition(localPos);
            } else {
                this.node.setWorldPosition(this._worldBonePos);
            }
        }

        // 2. Synchronize Rotation
        if (this.followRotation) {
            // Get bone world rotation from matrix coefficients (a, b, c, d)
            const radDeg = 180 / Math.PI;
            const boneWorldRotation = Math.atan2(bone.c, bone.a) * radDeg;

            // Combine with the skeleton node's world rotation
            const skeletonWorldRotation = skeletonNode.worldRotation.Length(); // approximation or euler
            const euler = new Vec3();
            skeletonNode.worldRotation.toEuler(euler);
            
            const totalRotation = euler.z + boneWorldRotation;
            this.node.setRotationFromEuler(0, 0, totalRotation);
        }

        // 3. Synchronize Scale
        if (this.followScale) {
            // Compute scale from the bone matrix coefficients
            const scaleX = Math.sqrt(bone.a * bone.a + bone.c * bone.c);
            const scaleY = Math.sqrt(bone.b * bone.b + bone.d * bone.d);
            
            const skeletonScale = skeletonNode.worldScale;
            this.node.setWorldScale(scaleX * skeletonScale.x, scaleY * skeletonScale.y, 1.0);
        }
    }
}
