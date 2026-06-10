import { _decorator, Component, Node, Vec3, sp } from 'cc';
const { ccclass, property } = _decorator;

/**
2D Inverse Kinematics (IK) Solver for Spine skeletons in Cocos Creator 3.x.
Allows a bone (e.g. head, arm) to look at or track a target node dynamically at runtime.
Supports both 1-bone and 2-bone IK calculation.
*/
@ccclass('SpineIKSolver')
export class SpineIKSolver extends Component {
    @property({ type: sp.Skeleton, tooltip: 'The Spine Skeleton component to modify' })
    skeleton: sp.Skeleton = null!;

    @property({ tooltip: 'The name of the main bone to rotate' })
    boneName: string = '';

    @property({ tooltip: 'The name of the child bone (leave empty for 1-bone IK)' })
    childBoneName: string = '';

    @property({ type: Node, tooltip: 'The Cocos Node target to track' })
    targetNode: Node = null!;

    @property({ slide: true, min: 0, max: 1, step: 0.05, tooltip: 'The mix factor (0 = no effect, 1 = full IK)' })
    mix: number = 1.0;

    @property({ tooltip: 'Bend direction for 2-bone IK (1 = bend outwards, -1 = bend inwards)' })
    bendDirection: number = 1;

    // Cache bone references
    private _bone: any = null;
    private _childBone: any = null;
    private _targetWorldPos: Vec3 = new Vec3();

    start() {
        if (!this.skeleton) {
            this.skeleton = this.getComponent(sp.Skeleton)!;
        }
        this._initBones();
    }

    private _initBones() {
        if (!this.skeleton || !this.skeleton.skeleton) return;
        const spineSkeleton = this.skeleton.skeleton;

        if (this.boneName) {
            this._bone = spineSkeleton.findBone(this.boneName);
            if (!this._bone) {
                console.warn(`[SpineIKSolver] Bone not found: ${this.boneName}`);
            }
        }

        if (this.childBoneName) {
            this._childBone = spineSkeleton.findBone(this.childBoneName);
            if (!this._childBone) {
                console.warn(`[SpineIKSolver] Child bone not found: ${this.childBoneName}`);
            }
        }
    }

    lateUpdate() {
        if (!this.skeleton || !this.targetNode || !this._bone) return;

        // Re-initialize bones if skeleton runtime loaded after start
        if (!this._bone.matrix) {
            this._initBones();
            if (!this._bone) return;
        }

        // Get target world position
        this.targetNode.getWorldPosition(this._targetWorldPos);

        // Convert target position to Spine skeleton node local space
        // Spine's world positions (worldX, worldY) are relative to the skeleton component's node origin.
        const skeletonNode = this.skeleton.node;
        const localTarget = new Vec3();
        skeletonNode.inverseTransformPoint(localTarget, this._targetWorldPos);

        // Run the appropriate solver
        if (this._childBone) {
            this._solve2BoneIK(localTarget.x, localTarget.y);
        } else {
            this._solve1BoneIK(localTarget.x, localTarget.y);
        }
    }

    /**
     * Solves 1-bone IK (e.g., look-at target)
     */
    private _solve1BoneIK(targetX: number, targetY: number) {
        const bone = this._bone;
        const parent = bone.parent;

        if (!parent) return;

        // Parent world transform matrix coefficients
        const pa = parent.a, pb = parent.b, pc = parent.c, pd = parent.d;
        
        // Relative target vector from parent origin
        const rx = targetX - parent.worldX;
        const ry = targetY - parent.worldY;

        // Invert parent matrix to convert target into parent's coordinate space
        const det = pa * pd - pb * pc;
        let tx = 0;
        let ty = 0;
        const epsilon = 0.00001;

        if (Math.abs(det) > epsilon) {
            tx = (rx * pd - ry * pb) / det - bone.x;
            ty = (ry * pa - rx * pc) / det - bone.y;
        }

        // Target angle in parent space (in degrees)
        const radDeg = 180 / Math.PI;
        let targetAngle = Math.atan2(ty, tx) * radDeg;

        if (bone.scaleX < 0) {
            targetAngle += 180;
        }

        // Normalize rotation difference between -180 and 180 degrees
        let rotationDiff = targetAngle - bone.shearX - bone.rotation;
        while (rotationDiff > 180) rotationDiff -= 360;
        while (rotationDiff <= -180) rotationDiff += 360;

        // Apply rotation blending
        bone.rotation += rotationDiff * this.mix;
        bone.updateWorldTransform();
    }

    /**
     * Solves 2-bone IK (e.g. arm or leg bending to reach a point)
     */
    private _solve2BoneIK(targetX: number, targetY: number) {
        const parent = this._bone;
        const child = this._childBone;

        if (!parent || !child || !parent.parent) return;

        const pParent = parent.parent;

        // Parent local transform
        const px = parent.x;
        const py = parent.y;
        let psx = parent.scaleX;
        let psy = parent.scaleY;
        let csx = child.scaleX;

        let os1 = 0;
        let s2 = 1;
        let os2 = 0;

        // Handle negative scales
        if (psx < 0) {
            psx = -psx;
            os1 = 180;
            s2 = -1;
        } else {
            os1 = 0;
            s2 = 1;
        }

        if (psy < 0) {
            psy = -psy;
            s2 = -s2;
        }

        if (csx < 0) {
            csx = -csx;
            os2 = 180;
        } else {
            os2 = 0;
        }

        // Parent's parent matrix coefficients
        const pa = pParent.a, pb = pParent.b, pc = pParent.c, pd = pParent.d;
        const det = pa * pd - pb * pc;
        if (Math.abs(det) <= 0.00001) return;

        const invDet = 1.0 / det;

        // Convert target into parent's parent local space
        const rx = targetX - pParent.worldX;
        const ry = targetY - pParent.worldY;
        const tx = (rx * pd - ry * pb) * invDet - px;
        const ty = (ry * pa - rx * pc) * invDet - py;

        // Lengths of bones
        const l1 = parent.data.length * psx;
        let l2 = child.data.length * csx;
        const dd = tx * tx + ty * ty;

        const epsilon = 0.00001;
        let a1 = 0;
        let a2 = 0;

        if (l1 < epsilon) {
            // Degenerate case: parent length is 0, fall back to 1-bone IK
            this._solve1BoneIK(targetX, targetY);
            child.rotation = 0;
            return;
        }

        const radDeg = 180 / Math.PI;
        const degRad = Math.PI / 180;
        const bendDir = this.bendDirection;

        // Solve standard uniform scaling case
        const isUniform = Math.abs(psx - psy) <= epsilon;
        if (isUniform) {
            l2 *= psx;
            let cos = (dd - l1 * l1 - l2 * l2) / (2 * l1 * l2);
            if (cos < -1) {
                cos = -1;
                a2 = Math.PI * bendDir;
            } else if (cos > 1) {
                cos = 1;
                a2 = 0;
            } else {
                a2 = Math.acos(cos) * bendDir;
            }
            
            const sa = l1 + l2 * cos;
            const sb = l2 * Math.sin(a2);
            a1 = Math.atan2(ty * sa - tx * sb, tx * sa + ty * sb);
        } else {
            // Non-uniform scaling solver
            const a = psx * l2;
            const b = psy * l2;
            const aa = a * a;
            const bb = b * b;
            const ta = Math.atan2(ty, tx);
            const cVal = bb * l1 * l1 + aa * dd - aa * bb;
            const c1 = -2 * bb * l1;
            const c2 = bb - aa;
            const dVal = c1 * c1 - 4 * c2 * cVal;

            let solved = false;
            if (dVal >= 0) {
                let q = Math.sqrt(dVal);
                if (c1 < 0) q = -q;
                q = -(c1 + q) * 0.5;
                const r0 = q / c2;
                const r1 = cVal / q;
                const r = Math.abs(r0) < Math.abs(r1) ? r0 : r1;
                const r0sq = dd - r * r;
                if (r0sq >= 0) {
                    const yVal = Math.sqrt(r0sq) * bendDir;
                    a1 = ta - Math.atan2(yVal, r);
                    a2 = Math.atan2(yVal / psy, (r - l1) / psx);
                    solved = true;
                }
            }
            if (!solved) {
                // Approximate solution if analytical fails
                a1 = ta;
                a2 = 0;
            }
        }

        // Convert angles to parent and child local space rotations
        const os = Math.atan2(child.y, child.x) * s2;
        let finalParentRot = (a1 - os) * radDeg + os1 - parent.rotation;
        while (finalParentRot > 180) finalParentRot -= 360;
        while (finalParentRot <= -180) finalParentRot += 360;

        parent.rotation += finalParentRot * this.mix;

        let finalChildRot = ((a2 + os) * radDeg - child.shearX) * s2 + os2 - child.rotation;
        while (finalChildRot > 180) finalChildRot -= 360;
        while (finalChildRot <= -180) finalChildRot += 360;

        child.rotation += finalChildRot * this.mix;

        // Propagate updates down the bone hierarchy
        parent.updateWorldTransform();
    }
}
