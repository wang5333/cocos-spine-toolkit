/**
 * 打工人 2D 骨骼动画引擎 (app.js)
 * 基于暗黑刺客 Spine JSON 物理层级还原，配合程序化无毛边矢量西装切片
 */

// 状态管理
const state = {
    spineData: null,
    bones: [],
    bonesByName: {},
    slots: [],
    slotsByName: {},
    drawOrder: [],
    animations: {},
    activeAnimation: 'walk',
    activeCharacter: 'salaryman', // 角色选择：'salaryman' 或 'assassin'
    isPlaying: true,
    speed: 1.0,
    scale: 0.55,
    showBones: false,
    suitColor: '#1d3557', // 默认商务蓝
    time: 0,
    lastFrameTime: 0,
    textures: {}, // 缓存所有离屏画布纹理
    hoveredBone: null,
    selectedBone: null
};

// 中文部件标签对照表
const PART_LABELS = {
    'body': '躯干 (body)',
    'hip': '跨部 (hip)',
    'collar': '衣领 (collar)',
    'hood': '外套兜帽 (hood)',
    'darkness': '面部 (darkness)',
    'eyes': '眼镜反光 (eyes)',
    'left_hand_1': '左大臂 (L_arm1)',
    'left_hand_2': '左小臂 (L_arm2)',
    'right_hand_2': '右大臂 (R_arm1)',
    'right_hand_1': '右小臂与公文包 (R_arm2)',
    'left_finger_1': '左拇指 (L_finger1)',
    'left_finger_2': '左食指 (L_finger2)',
    'right_finger_1': '右食指 (R_finger1)',
    'right_finger_2': '右拇指 (R_finger2)',
    'left_leg_3': '左大腿 (L_leg1)',
    'left_leg_2': '左小腿 (L_leg2)',
    'left_foot': '左皮鞋 (L_foot)',
    'right_leg_3': '右大腿 (R_leg1)',
    'right_leg_2': '右小腿 (R_leg2)',
    'right_foot': '右皮鞋 (R_foot)',
    'cape_background': '风衣后摆 (cape_bg)',
    'cape_left': '风衣左摆 (cape_L)',
    'cape_right': '风衣右摆 (cape_R)'
};

// 颜色明暗调整辅助函数
function adjustColorBrightness(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);
    
    R = Math.max(0, Math.min(255, R + percent));
    G = Math.max(0, Math.min(255, G + percent));
    B = Math.max(0, Math.min(255, B + percent));
    
    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`;
}

// 1. 程序化切片绘制引擎 (实时在离屏画布绘制，无毛边)
function generateTextures(suitColor) {
    const list = [
        { name: 'body', w: 241, h: 261 },
        { name: 'hip', w: 238, h: 124 },
        { name: 'collar', w: 308, h: 178 },
        { name: 'darkness', w: 427, h: 468 },
        { name: 'eyes', w: 237, h: 71 },
        { name: 'hood', w: 548, h: 662 },
        { name: 'left_hand_1', w: 124, h: 204 },
        { name: 'left_hand_2', w: 162, h: 270 },
        { name: 'right_hand_2', w: 127, h: 218 },
        { name: 'right_hand_1', w: 184, h: 284 }, // 右手含公文包
        { name: 'left_finger_1', w: 62, h: 93 },
        { name: 'left_finger_2', w: 62, h: 96 },
        { name: 'right_finger_1', w: 70, h: 94 },
        { name: 'right_finger_2', w: 71, h: 94 },
        { name: 'left_leg_3', w: 158, h: 225 },
        { name: 'left_leg_2', w: 100, h: 122 },
        { name: 'left_foot', w: 188, h: 131 },
        { name: 'right_leg_3', w: 160, h: 217 },
        { name: 'right_leg_2', w: 97, h: 125 },
        { name: 'right_foot', w: 189, h: 132 },
        { name: 'cape_background', w: 413, h: 512 },
        { name: 'cape_left', w: 168, h: 517 },
        { name: 'cape_right', w: 255, h: 512 }
    ];

    list.forEach(item => {
        const canvas = document.createElement('canvas');
        canvas.width = item.w;
        canvas.height = item.h;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, item.w, item.h);
        drawSalarymanPart(item.name, ctx, item.w, item.h, suitColor);
        state.textures[item.name] = canvas;
    });

    updatePartsUI();
}

// 加载并初始化原版刺客的高清 PNG 切片贴图
function loadAssassinTextures() {
    const list = [
        'body', 'hip', 'collar', 'darkness', 'eyes', 'hood',
        'left_hand_1', 'left_hand_2', 'right_hand_2', 'right_hand_1',
        'left_finger_1', 'left_finger_2', 'right_finger_1', 'right_finger_2',
        'left_leg_3', 'left_leg_2', 'left_foot', 'right_leg_3', 'right_leg_2', 'right_foot',
        'cape_background', 'cape_left', 'cape_right'
    ];
    
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = '加载原版贴图...';
    
    let loadedCount = 0;
    list.forEach(name => {
        const img = new Image();
        // 动态加载刺客解压出来的图片，附加时间戳缓存击穿参数
        img.src = `assassin_data/images/${name}.png?v=${Date.now()}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // 写入贴图缓存，和程序化Canvas数据结构100%兼容
            state.textures[name] = canvas;
            
            loadedCount++;
            if (loadedCount === list.length) {
                if (statusText) statusText.textContent = '运行中';
                updatePartsUI();
            }
        };
        img.onerror = () => {
            console.error(`无法加载刺客贴图: ${name}，使用空画布代替`);
            const canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;
            state.textures[name] = canvas;
            
            loadedCount++;
            if (loadedCount === list.length) {
                if (statusText) statusText.textContent = '运行中';
                updatePartsUI();
            }
        };
    });
}

// 具体身体切片矢量路径绘制
function drawSalarymanPart(name, ctx, w, h, suitColor) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const darkSuit = adjustColorBrightness(suitColor, -15);
    const darkerSuit = adjustColorBrightness(suitColor, -25);
    const highlightSuit = adjustColorBrightness(suitColor, 15);

    if (name === 'body') {
        // 西服躯干
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(1, darkSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(35, 10);
        ctx.lineTo(205, 10);
        ctx.lineTo(215, h - 15);
        ctx.lineTo(25, h - 15);
        ctx.closePath();
        ctx.fill();

        // 衬衫V字领
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(85, 10);
        ctx.lineTo(155, 10);
        ctx.lineTo(120, 105);
        ctx.closePath();
        ctx.fill();

        // 红色领带
        const tieGrad = ctx.createLinearGradient(0, 40, 0, h);
        tieGrad.addColorStop(0, '#e63946');
        tieGrad.addColorStop(1, '#a30015');
        ctx.fillStyle = tieGrad;
        ctx.beginPath();
        ctx.moveTo(112, 50);
        ctx.lineTo(128, 50);
        ctx.lineTo(135, h - 50);
        ctx.lineTo(120, h - 30);
        ctx.lineTo(105, h - 50);
        ctx.closePath();
        ctx.fill();

        // 西服外套领口与缝线
        ctx.strokeStyle = darkerSuit;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(85, 10);
        ctx.lineTo(102, 95);
        ctx.lineTo(120, 105);
        ctx.lineTo(138, 95);
        ctx.lineTo(155, 10);
        ctx.stroke();

        // 外套扣子
        ctx.fillStyle = '#ffb703';
        ctx.beginPath();
        ctx.arc(120, 150, 6, 0, Math.PI * 2);
        ctx.arc(120, 190, 6, 0, Math.PI * 2);
        ctx.fill();

    } else if (name === 'hip') {
        // 跨部/皮带处
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(1, darkSuit);
        ctx.fillStyle = grad;
        ctx.fillRect(10, 15, w - 20, h - 30);

        // 黑色皮带
        ctx.fillStyle = '#1e1b18';
        ctx.fillRect(10, 15, w - 20, 24);

        // 金属皮带扣
        ctx.fillStyle = '#ffb703'; // 金色
        ctx.fillRect(w/2 - 18, 10, 36, 34);
        ctx.fillStyle = '#333';
        ctx.fillRect(w/2 - 10, 18, 20, 18);

    } else if (name === 'collar') {
        // 衣领
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(105, 30);
        ctx.lineTo(154, 115);
        ctx.lineTo(154, 30);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(203, 30);
        ctx.lineTo(154, 115);
        ctx.lineTo(154, 30);
        ctx.closePath();
        ctx.fill();

        // 领带结
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.moveTo(142, 85);
        ctx.lineTo(166, 85);
        ctx.lineTo(160, 115);
        ctx.lineTo(148, 115);
        ctx.closePath();
        ctx.fill();

    } else if (name === 'darkness') {
        // 脸部 (暗黑刺客里面是兜帽深处，我们这里画打工人的疲惫脸庞)
        const cx = w / 2;
        const cy = h / 2;

        // 脖子
        ctx.fillStyle = '#ebd0c1';
        ctx.fillRect(cx - 32, cy + 50, 64, 80);

        // 脸部轮廓
        ctx.fillStyle = '#fceade'; // 亚健康偏白肤色
        ctx.beginPath();
        ctx.arc(cx, cy, 95, 0, Math.PI * 2);
        ctx.fill();

        // 浓重的黑眼圈 (加班痕迹)
        ctx.strokeStyle = 'rgba(112, 108, 140, 0.22)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(cx - 42, cy + 3, 22, 0.1, Math.PI - 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 42, cy + 3, 22, 0.1, Math.PI - 0.1);
        ctx.stroke();

        // 呆滞/疲惫的平线嘴
        ctx.strokeStyle = '#a56c5e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 28, cy + 48);
        ctx.lineTo(cx + 28, cy + 48);
        ctx.stroke();

        // 细黑框眼镜
        ctx.strokeStyle = '#1e1b18';
        ctx.lineWidth = 5;
        ctx.strokeRect(cx - 78, cy - 25, 62, 36);
        ctx.strokeRect(cx + 16, cy - 25, 62, 36);
        // 眼镜中梁
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy - 7);
        ctx.lineTo(cx + 16, cy - 7);
        ctx.stroke();
        // 镜腿
        ctx.beginPath();
        ctx.moveTo(cx - 78, cy - 7);
        ctx.lineTo(cx - 110, cy - 12);
        ctx.moveTo(cx + 78, cy - 7);
        ctx.lineTo(cx + 110, cy - 12);
        ctx.stroke();

    } else if (name === 'eyes') {
        // 眼镜反光 (对应刺客发光的眼睛，随着eyes骨骼动，非常带感)
        const cx = w / 2;
        const cy = h / 2;
        
        // 蓝绿色科技感斜线反光
        const glare = ctx.createLinearGradient(0, 0, w, h);
        glare.addColorStop(0.1, 'rgba(6, 182, 212, 0.65)');
        glare.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)'); // 白色反光条
        glare.addColorStop(0.9, 'rgba(6, 182, 212, 0.2)');

        ctx.fillStyle = glare;
        ctx.fillRect(cx - 73, cy - 20, 52, 26);
        ctx.fillRect(cx + 21, cy - 20, 52, 26);

    } else if (name === 'hood') {
        // 外套兜帽与乱发
        const cx = w / 2;
        const cy = h / 2;

        // 乱糟糟的头发 (程序员风)
        ctx.fillStyle = '#3a322c'; // 深褐发色
        ctx.beginPath();
        ctx.arc(cx, cy - 115, 100, Math.PI, 0); // 头顶
        ctx.fill();
        
        // 乱发发梢
        ctx.beginPath();
        ctx.moveTo(cx - 100, cy - 115);
        ctx.lineTo(cx - 100, cy - 40);
        ctx.lineTo(cx - 82, cy - 70);
        ctx.lineTo(cx - 75, cy - 40);
        ctx.lineTo(cx - 60, cy - 80);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx + 100, cy - 115);
        ctx.lineTo(cx + 100, cy - 40);
        ctx.lineTo(cx + 82, cy - 70);
        ctx.lineTo(cx + 75, cy - 40);
        ctx.lineTo(cx + 60, cy - 80);
        ctx.closePath();
        ctx.fill();

        // 休闲商务大衣兜帽 (外套主体)
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0.1, suitColor);
        grad.addColorStop(1, darkerSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx - 190, cy + 250);
        ctx.bezierCurveTo(cx - 190, cy - 90, cx + 190, cy - 90, cx + 190, cy + 250);
        ctx.lineTo(cx + 130, cy + 290);
        ctx.lineTo(cx - 130, cy + 290);
        ctx.closePath();
        ctx.fill();

        // 镂空出脸部区域 (复合操作剪裁，无缝隙)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy - 5, 110, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

    } else if (name === 'left_hand_1' || name === 'right_hand_2') {
        // 上臂西装衣袖
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(1, darkSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(w/2, h/2, w/2.6, h/2.1, 0, 0, Math.PI * 2);
        ctx.fill();

    } else if (name === 'left_hand_2') {
        // 左手前臂衣袖与手掌
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(0.8, darkSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(35, 15);
        ctx.lineTo(105, 15);
        ctx.lineTo(85, 205);
        ctx.lineTo(45, 205);
        ctx.closePath();
        ctx.fill();

        // 白色衬衫袖口露出
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(45, 205, 40, 12);

        // 肤色手部
        ctx.fillStyle = '#fceade';
        ctx.beginPath();
        ctx.arc(65, 235, 22, 0, Math.PI * 2);
        ctx.fill();

    } else if (name === 'right_hand_1') {
        // 右手前臂与【商务公文包】 (最炫部分，挂在右手并随着右手臂走步摆动)
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(0.7, darkSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(40, 10);
        ctx.lineTo(110, 10);
        ctx.lineTo(95, 135);
        ctx.lineTo(55, 135);
        ctx.closePath();
        ctx.fill();

        // 白色衬衫袖口
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(55, 135, 40, 10);

        // 肤色手掌 (半握拳提公文包)
        ctx.fillStyle = '#fceade';
        ctx.beginPath();
        ctx.arc(75, 158, 18, 0, Math.PI * 2);
        ctx.fill();

        // 提包手柄
        ctx.strokeStyle = '#5a3d28'; // 皮质棕
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(75, 172, 13, Math.PI, 0);
        ctx.stroke();

        // 商务公文包主体 (质感皮包)
        const caseGrad = ctx.createLinearGradient(20, 185, 20, 275);
        caseGrad.addColorStop(0, '#854f2b'); // 中棕色皮
        caseGrad.addColorStop(1, '#472a15'); // 深焦糖色
        ctx.fillStyle = caseGrad;
        
        ctx.beginPath();
        ctx.roundRect(10, 180, w - 20, 92, 10);
        ctx.fill();

        // 装饰拉链与卡扣
        ctx.fillStyle = '#ffb703'; // 金色锁扣
        ctx.fillRect(42, 180, 16, 16);
        ctx.fillRect(w - 58, 180, 16, 16);

        // 双边压线
        ctx.strokeStyle = '#2d180b';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(10, 180, w - 20, 92);

    } else if (name.includes('finger')) {
        // 手指
        ctx.fillStyle = '#fceade';
        ctx.beginPath();
        ctx.ellipse(w/2, h/2, w/3.2, h/2.2, 0, 0, Math.PI*2);
        ctx.fill();

    } else if (name === 'left_leg_3' || name === 'right_leg_3') {
        // 西裤大腿
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(1, darkSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(w/2, h/2, w/3.2, h/2.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // 笔直的西裤熨帖线
        ctx.strokeStyle = highlightSuit;
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w/2 - 2, 5);
        ctx.lineTo(w/2 - 2, h - 5);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

    } else if (name === 'left_leg_2' || name === 'right_leg_2') {
        // 西裤小腿
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, suitColor);
        grad.addColorStop(1, darkSuit);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(18, 5);
        ctx.lineTo(w - 18, 5);
        ctx.lineTo(w - 24, h - 5);
        ctx.lineTo(24, h - 5);
        ctx.closePath();
        ctx.fill();

        // 熨帖线
        ctx.strokeStyle = highlightSuit;
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w/2 - 1, 5);
        ctx.lineTo(w/2 - 1, h - 5);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

    } else if (name === 'left_foot' || name === 'right_foot') {
        // 意式褐色商务皮鞋
        const shoeGrad = ctx.createLinearGradient(0, 0, 0, h);
        shoeGrad.addColorStop(0.1, '#543825'); // 植鞣革棕
        shoeGrad.addColorStop(0.8, '#321f14');
        shoeGrad.addColorStop(1, '#111111'); // 黑色鞋底
        ctx.fillStyle = shoeGrad;

        ctx.beginPath();
        ctx.moveTo(12, 90);
        ctx.bezierCurveTo(12, 35, 68, 15, 118, 25);
        ctx.bezierCurveTo(158, 35, w - 12, 75, w - 12, 100);
        ctx.lineTo(w - 12, 112);
        ctx.lineTo(12, 112);
        ctx.closePath();
        ctx.fill();

        // 橡胶大底
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(10, 112, w - 20, 8); // 鞋底
        ctx.fillRect(16, 120, 42, 6);   // 鞋跟

        // 鞋带点缀
        ctx.strokeStyle = '#c5a880';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(92, 34);
        ctx.lineTo(112, 44);
        ctx.moveTo(94, 44);
        ctx.lineTo(110, 34);
        ctx.stroke();

    } else if (name.startsWith('cape_') || name === 'cape_background') {
        // 飘逸的长风衣下摆 (风衣代替披风，利用刺客的披风物理骨骼完美飘动)
        const capeColor = adjustColorBrightness(suitColor, -12);
        const capeGrad = ctx.createLinearGradient(0, 0, w, h);
        capeGrad.addColorStop(0, capeColor);
        capeGrad.addColorStop(1, adjustColorBrightness(capeColor, -24));
        ctx.fillStyle = capeGrad;

        ctx.beginPath();
        if (name === 'cape_background') {
            ctx.moveTo(150, 10);
            ctx.bezierCurveTo(385, 10, w - 10, 340, w - 30, h - 15);
            ctx.lineTo(30, h - 15);
            ctx.bezierCurveTo(10, 340, 30, 10, 150, 10);
        } else if (name === 'cape_left') {
            ctx.moveTo(135, 10);
            ctx.bezierCurveTo(155, 150, 145, 380, 115, h - 15);
            ctx.lineTo(10, h - 15);
            ctx.bezierCurveTo(28, 380, 48, 150, 135, 10);
        } else { // cape_right
            ctx.moveTo(20, 10);
            ctx.bezierCurveTo(145, 50, w - 20, 240, w - 30, h - 15);
            ctx.lineTo(30, h - 15);
            ctx.bezierCurveTo(30, 240, 10, 50, 20, 10);
        }
        ctx.closePath();
        ctx.fill();

        // 大衣的风压褶皱阴影
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        if (name === 'cape_background') {
            ctx.moveTo(200, 10);
            ctx.bezierCurveTo(240, 200, 220, 350, 190, h - 20);
            ctx.moveTo(100, 20);
            ctx.bezierCurveTo(120, 180, 110, 330, 80, h - 20);
        } else {
            ctx.moveTo(w/2, 20);
            ctx.bezierCurveTo(w/2 + 15, h/3, w/2 - 10, 2*h/3, w/2 - 20, h - 20);
        }
        ctx.stroke();
    }
}

// 更新界面零件展示网格
function updatePartsUI() {
    const grid = document.getElementById('parts-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    Object.keys(state.textures).forEach(name => {
        const thumb = document.createElement('div');
        thumb.className = 'part-thumb';
        
        // 离屏画布
        const origCanvas = state.textures[name];
        
        // 缩略图画布
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 60;
        thumbCanvas.height = 60;
        const tCtx = thumbCanvas.getContext('2d');
        
        // 自适应等比居中渲染
        const max = Math.max(origCanvas.width, origCanvas.height);
        const sw = origCanvas.width * (50 / max);
        const sh = origCanvas.height * (50 / max);
        tCtx.drawImage(origCanvas, 5, 5, sw, sh);
        
        const span = document.createElement('span');
        span.textContent = PART_LABELS[name] || name;
        
        thumb.appendChild(thumbCanvas);
        thumb.appendChild(span);
        grid.appendChild(thumb);
    });
}


// 预处理动画数据，解决 Spine JSON 中省略 0 值的 time 属性引发的 NaN 崩溃问题
function preprocessAnimations() {
    Object.keys(state.animations).forEach(animName => {
        const anim = state.animations[animName];
        if (!anim) return;
        
        let maxDur = 0;
        
        // 归一化骨骼时间轴
        if (anim.bones) {
            Object.keys(anim.bones).forEach(boneName => {
                const channels = anim.bones[boneName];
                Object.keys(channels).forEach(channelName => {
                    const keys = channels[channelName];
                    if (Array.isArray(keys)) {
                        keys.forEach(key => {
                            if (key.time === undefined) key.time = 0;
                            maxDur = Math.max(maxDur, key.time);
                        });
                    }
                });
            });
        }
        
        // 归一化插槽/网格变形时间轴
        if (anim.deform) {
            Object.keys(anim.deform).forEach(skinName => {
                const skinDeform = anim.deform[skinName];
                Object.keys(skinDeform).forEach(slotName => {
                    const attachmentsDeform = skinDeform[slotName];
                    Object.keys(attachmentsDeform).forEach(attachName => {
                        const keys = attachmentsDeform[attachName];
                        if (Array.isArray(keys)) {
                            keys.forEach(key => {
                                if (key.time === undefined) key.time = 0;
                                maxDur = Math.max(maxDur, key.time);
                            });
                        }
                    });
                });
            });
        }
        
        // 归一化绘制次序时间轴
        if (anim.drawOrder) {
            if (Array.isArray(anim.drawOrder)) {
                anim.drawOrder.forEach(key => {
                    if (key.time === undefined) key.time = 0;
                    maxDur = Math.max(maxDur, key.time);
                });
            }
        }
        
        // 归一化 IK 时间轴
        if (anim.ik) {
            Object.keys(anim.ik).forEach(ikName => {
                const keys = anim.ik[ikName];
                if (Array.isArray(keys)) {
                    keys.forEach(key => {
                        if (key.time === undefined) key.time = 0;
                        maxDur = Math.max(maxDur, key.time);
                    });
                }
            });
        }

        // 归一化插槽 (slots) 时间轴
        if (anim.slots) {
            Object.keys(anim.slots).forEach(slotName => {
                const channels = anim.slots[slotName];
                Object.keys(channels).forEach(channelName => {
                    const keys = channels[channelName];
                    if (Array.isArray(keys)) {
                        keys.forEach(key => {
                            if (key.time === undefined) key.time = 0;
                            maxDur = Math.max(maxDur, key.time);
                        });
                    }
                });
            });
        }

        // 记录动画的最大持续时间，默认最少为 1.0 秒
        anim.duration = maxDur > 0 ? maxDur : 1.0;
    });
}

// 2. Spine 骨骼体系加载与解算器
async function initSpine() {
    try {
        const res = await fetch('spine_data/DarkAssassin.json');
        if (!res.ok) throw new Error('Spine 数据加载失败');
        const json = await res.json();
        state.spineData = json;
        
        // 解析骨骼 setup pose
        buildBones(json.bones);
        
        // 解析插槽 setup pose
        buildSlots(json.slots);
        
        // 加载动画列表
        state.animations = json.animations || {};
        preprocessAnimations();
        const animSelect = document.getElementById('anim-select');
        if (animSelect) {
            animSelect.innerHTML = '';
            Object.keys(state.animations).forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = getChineseAnimName(name);
                if (name === state.activeAnimation) opt.selected = true;
                animSelect.appendChild(opt);
            });
        }
        
        // 解析默认皮肤的蒙皮网格 (23个全部是Mesh)
        const defaultSkin = json.skins.find(s => s.name === 'default') || json.skins[0];
        buildMeshes(defaultSkin.attachments);

        // 初始化骨骼树 UI
        buildBoneTreeUI();
        
        // 关闭加载框
        const loader = document.getElementById('loader');
        if (loader) loader.style.opacity = 0;
        setTimeout(() => { if (loader) loader.style.display = 'none'; }, 400);

        // 更新状态数据显示
        document.getElementById('info-bones').textContent = state.bones.length;
        document.getElementById('info-slots').textContent = state.slots.length;
        
        // 开启渲染循环
        state.lastFrameTime = performance.now();
        requestAnimationFrame(renderLoop);

    } catch (e) {
        console.error(e);
        document.getElementById('status-text').textContent = '加载失败: ' + e.message;
    }
}

// 动画名翻译
function getChineseAnimName(name) {
    const dict = {
        'Attack': '⚔️ 攻击 (Attack)',
        'die': '💀 死亡 (Die)',
        'hurt': '💥 受击 (Hurt)',
        'idle': '🧘 待机 (Idle)',
        'jump': '👟 起跳 (Jump_start)',
        'jump_airborne': '☁️ 滞空 (Jump_air)',
        'jump_airborne_attack': '☄️ 空中攻击 (Jump_atk)',
        'jump_land': '🧱 着陆 (Jump_land)',
        'run': '🏃 奔跑 (Run)',
        'run_attack': '🤺 跑动攻击 (Run_atk)',
        'walk': '💼 上班赶路 (Walk)',
        'walk_attack': '💼 突发应对 (Walk_atk)'
    };
    return dict[name] || name;
}

// 骨骼矩阵定义与更新
class Bone {
    constructor(data, index) {
        this.index = index;
        this.name = data.name;
        this.parentName = data.parent;
        this.parent = null;
        this.children = [];
        this.length = data.length || 0;
        this.rotation = data.rotation || 0;
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.scaleX = data.scaleX !== undefined ? data.scaleX : 1;
        this.scaleY = data.scaleY !== undefined ? data.scaleY : 1;
        this.transformMode = data.transform || 'normal'; // noScale 等

        // 原始 Setup Pose，用于增量动画
        this.setup = {
            rotation: this.rotation,
            x: this.x,
            y: this.y,
            scaleX: this.scaleX,
            scaleY: this.scaleY
        };

        // 世界转换矩阵 (2x3 Affine Matrix)
        this.a = 1; this.b = 0; this.worldX = 0;
        this.c = 0; this.d = 1; this.worldY = 0;
    }

    reset() {
        this.x = this.setup.x;
        this.y = this.setup.y;
        this.rotation = this.setup.rotation;
        this.scaleX = this.setup.scaleX;
        this.scaleY = this.setup.scaleY;
    }

    updateWorldTransform() {
        const rotationRad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);

        // 本地矩阵
        const la = cos * this.scaleX;
        const lb = -sin * this.scaleY;
        const lc = sin * this.scaleX;
        const ld = cos * this.scaleY;
        const lx = this.x;
        const ly = this.y;

        const parent = this.parent;
        if (parent) {
            let pa = parent.a;
            let pb = parent.b;
            let pc = parent.c;
            let pd = parent.d;
            const px = parent.worldX;
            const py = parent.worldY;

            // 缩放继承处理
            if (this.transformMode === 'noScale') {
                const sx = Math.sqrt(pa * pa + pc * pc);
                const sy = Math.sqrt(pb * pb + pd * pd);
                if (sx > 0.0001) { pa /= sx; pc /= sx; }
                if (sy > 0.0001) { pb /= sy; pd /= sy; }
            }

            // 级联矩阵乘法
            this.a = pa * la + pb * lc;
            this.b = pa * lb + pb * ld;
            this.worldX = pa * lx + pb * ly + px;
            this.c = pc * la + pd * lc;
            this.d = pc * lb + pd * ld;
            this.worldY = pc * lx + pd * ly + py;
        } else {
            // Root 骨骼或根节点
            this.a = la;
            this.b = lb;
            this.worldX = lx;
            this.c = lc;
            this.d = ld;
            this.worldY = ly;
        }
    }
}

// 解析骨骼层级关系
function buildBones(bonesArray) {
    state.bones = [];
    state.bonesByName = {};
    
    bonesArray.forEach((data, index) => {
        const bone = new Bone(data, index);
        state.bones.push(bone);
        state.bonesByName[bone.name] = bone;
    });

    // 建立树拓扑结构
    state.bones.forEach(bone => {
        if (bone.parentName) {
            const parent = state.bonesByName[bone.parentName];
            if (parent) {
                bone.parent = parent;
                parent.children.push(bone);
            }
        }
    });
}

class Slot {
    constructor(data, index) {
        this.index = index;
        this.name = data.name;
        this.boneName = data.bone;
        this.bone = null;
        this.attachmentName = data.attachment;
        this.activeAttachment = null;
    }
}

function buildSlots(slotsArray) {
    state.slots = [];
    state.slotsByName = {};
    
    slotsArray.forEach((data, index) => {
        const slot = new Slot(data, index);
        slot.bone = state.bonesByName[slot.boneName];
        state.slots.push(slot);
        state.slotsByName[slot.name] = slot;
    });
    // 拷贝默认渲染次序
    state.drawOrder = [...state.slots];
}

// 蒙皮网格结构设计
class MeshAttachment {
    constructor(name, data) {
        this.name = name;
        this.uvs = data.uvs;
        this.triangles = data.triangles;
        this.rawVertices = data.vertices;
        this.width = data.width;
        this.height = data.height;

        this.vertices = []; // 展开之后的顶点列表
        this.flatWeights = []; // flat权重引用，用于Deform增量修改

        this.buildVerticesStructure();
    }

    // 展开并归一化骨骼蒙皮结构，方便高速计算
    buildVerticesStructure() {
        const uvsCount = this.uvs.length / 2;
        const raw = this.rawVertices;
        let readIdx = 0;

        const isWeighted = raw.length > this.uvs.length;

        for (let i = 0; i < uvsCount; i++) {
            const vertex = {
                u: this.uvs[i * 2],
                v: this.uvs[i * 2 + 1],
                weights: [],
                // 实时计算出来的世界坐标
                worldX: 0,
                worldY: 0
            };

            if (isWeighted) {
                const numBones = raw[readIdx++];
                for (let j = 0; j < numBones; j++) {
                    const boneIdx = raw[readIdx++];
                    const localX = raw[readIdx++];
                    const localY = raw[readIdx++];
                    const weightVal = raw[readIdx++];

                    const w = {
                        boneIndex: boneIdx,
                        x: localX,
                        y: localY,
                        weight: weightVal,
                        // 动态加偏后的激活坐标 (支持Deform)
                        activeX: localX,
                        activeY: localY
                    };
                    vertex.weights.push(w);
                    this.flatWeights.push(w);
                }
            } else {
                // 非加权Mesh (即Region形态，绑定在所属Slot骨骼上)
                const localX = raw[readIdx++];
                const localY = raw[readIdx++];
                const w = {
                    boneIndex: -1, // 使用插槽绑定的骨骼
                    x: localX,
                    y: localY,
                    weight: 1.0,
                    activeX: localX,
                    activeY: localY
                };
                vertex.weights.push(w);
                this.flatWeights.push(w);
            }
            this.vertices.push(vertex);
        }
    }

    // 重置Deform偏移
    resetDeform() {
        this.flatWeights.forEach(w => {
            w.activeX = w.x;
            w.activeY = w.y;
        });
    }

    // 应用Deform顶点的相对偏移
    applyDeform(offset, verticesOffsets) {
        // verticesOffsets为 [dx0, dy0, dx1, dy1, ...]
        for (let i = 0; i < this.flatWeights.length; i++) {
            const w = this.flatWeights[i];
            const dxIdx = (i * 2) - offset;
            const dyIdx = (i * 2 + 1) - offset;
            
            const dx = (dxIdx >= 0 && dxIdx < verticesOffsets.length) ? verticesOffsets[dxIdx] : 0;
            const dy = (dyIdx >= 0 && dyIdx < verticesOffsets.length) ? verticesOffsets[dyIdx] : 0;

            w.activeX = w.x + dx;
            w.activeY = w.y + dy;
        }
    }

    // 蒙皮权重世界坐标变换计算
    updateWorldPositions(slotBone, bonesList) {
        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            let wx = 0;
            let wy = 0;

            for (let j = 0; j < v.weights.length; j++) {
                const w = v.weights[j];
                const bone = w.boneIndex === -1 ? slotBone : bonesList[w.boneIndex];
                
                // 本地坐标转世界坐标矩阵变换 (M_world * localPos)
                const x = w.activeX;
                const y = w.activeY;
                const vx = bone.a * x + bone.b * y + bone.worldX;
                const vy = bone.c * x + bone.d * y + bone.worldY;

                wx += vx * w.weight;
                wy += vy * w.weight;
            }

            v.worldX = wx;
            v.worldY = wy;
        }
    }
}

function buildMeshes(attachmentsData) {
    Object.keys(attachmentsData).forEach(slotName => {
        const slot = state.slotsByName[slotName];
        if (!slot) return;
        
        Object.keys(attachmentsData[slotName]).forEach(attachName => {
            const data = attachmentsData[slotName][attachName];
            if (data.type === 'mesh') {
                const mesh = new MeshAttachment(attachName, data);
                if (slot.attachmentName === attachName) {
                    slot.activeAttachment = mesh;
                }
            }
        });
    });
}

// 递归计算骨骼树世界矩阵
function updateBonesHierarchy() {
    const root = state.bones[0]; // 假定 root 是第一根骨骼
    if (root) {
        updateBoneSubtree(root);
    }
}

function updateBoneSubtree(bone) {
    bone.updateWorldTransform();
    bone.children.forEach(child => updateBoneSubtree(child));
}


// 3. 2-Bone IK 约束求解器
function applyIkConstraints() {
    const ikArray = state.spineData.ik || [];
    // 按照 order 排列
    const sortedIk = [...ikArray].sort((x, y) => (x.order || 0) - (y.order || 0));

    sortedIk.forEach(ik => {
        if (ik.bones.length === 2) {
            solve2BoneIk(ik);
        }
    });
}

function solve2BoneIk(ik) {
    const parent = state.bonesByName[ik.bones[0]];
    const child = state.bonesByName[ik.bones[1]];
    const target = state.bonesByName[ik.target];
    const bendDir = ik.bendPositive !== false ? 1 : -1;
    const mix = 1.0; // 默认 mix 权重为 1

    if (!parent || !child || !target) return;

    const px = parent.x;
    const py = parent.y;
    let psx = parent.scaleX;
    let psy = parent.scaleY;
    let csx = child.scaleX;

    let os1 = 0;
    let s2 = 1;
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
    let os2 = 0;
    if (csx < 0) {
        csx = -csx;
        os2 = 180;
    } else {
        os2 = 0;
    }

    // 父骨骼的仿射变换参数
    let a = parent.a;
    let b = parent.b;
    let c = parent.c;
    let d = parent.d;
    const u = Math.abs(psx - psy) <= 0.00001;

    let cwx, cwy;
    // 计算子骨骼的世界坐标 (Spine 算法逻辑)
    if (!u) {
        cwx = a * child.x + parent.worldX;
        cwy = c * child.x + parent.worldY;
    } else {
        cwx = a * child.x + b * child.y + parent.worldX;
        cwy = c * child.x + d * child.y + parent.worldY;
    }

    // 父骨骼的父骨骼 (pp) 的世界矩阵与求逆，用于变换到 pp 的局部坐标系
    const pp = parent.parent;
    const ppa = pp ? pp.a : 1;
    const ppb = pp ? pp.b : 0;
    const ppc = pp ? pp.c : 0;
    const ppd = pp ? pp.d : 1;
    const ppWorldX = pp ? pp.worldX : 0;
    const ppWorldY = pp ? pp.worldY : 0;

    let id = ppa * ppd - ppb * ppc;
    id = Math.abs(id) <= 0.00001 ? 0 : 1 / id;

    // 将子骨骼世界坐标转换到 pp 的局部坐标系，并计算相对于 parent 的向量 dx, dy
    const cx = cwx - ppWorldX;
    const cy = cwy - ppWorldY;
    const dx = (cx * ppd - cy * ppb) * id - px;
    const dy = (cy * ppa - cx * ppc) * id - py;

    const l1 = Math.sqrt(dx * dx + dy * dy);
    let l2 = child.length * csx;

    if (l1 < 0.00001) {
        // 单骨骼 IK 退化处理 (父子重合时的极度特例)
        const parentParentWorldRotation = pp ? Math.atan2(pp.c, pp.a) : 0;
        const targetDx = target.worldX - parent.worldX;
        const targetDy = target.worldY - parent.worldY;
        const angle = Math.atan2(targetDy, targetDx) - parentParentWorldRotation;
        let diff = angle * 180 / Math.PI - parent.rotation;
        if (diff > 180) diff -= 360;
        else if (diff <= -180) diff += 360;
        parent.rotation += diff * mix;
        child.rotation = 0;
        updateBoneSubtree(parent);
        return;
    }

    // 将 IK 控制目标 (target) 的世界坐标转换到 pp 的局部坐标系
    const txVal = target.worldX - ppWorldX;
    const tyVal = target.worldY - ppWorldY;
    const tx = (txVal * ppd - tyVal * ppb) * id - px;
    const ty = (tyVal * ppa - txVal * ppc) * id - py;

    const dd = tx * tx + ty * ty;
    let a1, a2;

    if (u) {
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
        const sideA = l1 + l2 * cos;
        const sideB = l2 * Math.sin(a2);
        a1 = Math.atan2(ty * sideA - tx * sideB, tx * sideA + ty * sideB);
    } else {
        // 父骨骼缩放非均匀时的复杂椭圆相交解算
        const sideA = psx * l2;
        const sideB = psy * l2;
        const aa = sideA * sideA;
        const bb = sideB * sideB;
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
            const r0Sq = dd - r * r;
            if (r0Sq >= 0) {
                const yVal = Math.sqrt(r0Sq) * bendDir;
                a1 = ta - Math.atan2(yVal, r);
                a2 = Math.atan2(yVal / psy, (r - l1) / psx);
                solved = true;
            }
        }

        if (!solved) {
            // 无解时的几何退化备用方案
            let minAngle = Math.PI, minX = l1 - sideA, minDist = minX * minX, minY = 0;
            let maxAngle = 0, maxX = l1 + sideA, maxDist = maxX * maxX, maxY = 0;
            let cVal2 = -sideA * l1 / (aa - bb);
            if (cVal2 >= -1 && cVal2 <= 1) {
                const cAngle = Math.acos(cVal2);
                const xVal2 = sideA * Math.cos(cAngle) + l1;
                const yVal2 = sideB * Math.sin(cAngle);
                const dDist = xVal2 * xVal2 + yVal2 * yVal2;
                if (dDist < minDist) {
                    minAngle = cAngle;
                    minDist = dDist;
                    minX = xVal2;
                    minY = yVal2;
                }
                if (dDist > maxDist) {
                    maxAngle = cAngle;
                    maxDist = dDist;
                    maxX = xVal2;
                    maxY = yVal2;
                }
            }
            if (dd <= (minDist + maxDist) * 0.5) {
                a1 = ta - Math.atan2(minY * bendDir, minX);
                a2 = minAngle * bendDir;
            } else {
                a1 = ta - Math.atan2(maxY * bendDir, maxX);
                a2 = maxAngle * bendDir;
            }
        }
    }

    // 将算出的父子骨骼旋转角度转换回 local 增量，并累加到骨骼 rotation 上
    const os = Math.atan2(child.y, child.x) * s2;
    let rotationIKparent = (a1 - os) * 180 / Math.PI + os1 - parent.rotation;
    if (rotationIKparent > 180) rotationIKparent -= 360;
    else if (rotationIKparent <= -180) rotationIKparent += 360;
    parent.rotation += rotationIKparent * mix;

    const childShearX = child.shearX || 0;
    let rotationIKchild = ((a2 + os) * 180 / Math.PI - childShearX) * s2 + os2 - child.rotation;
    if (rotationIKchild > 180) rotationIKchild -= 360;
    else if (rotationIKchild <= -180) rotationIKchild += 360;
    child.rotation += rotationIKchild * mix;

    // 级联刷新受影响的父骨骼子树世界矩阵
    updateBoneSubtree(parent);
}


// 4. 关键帧动画插值与贝塞尔求解
function getTimelineValue(keys, time, defaultValue, keyName) {
    if (!keys || keys.length === 0) return defaultValue;
    if (time <= keys[0].time) return keys[0][keyName] !== undefined ? keys[0][keyName] : defaultValue;
    if (time >= keys[keys.length - 1].time) return keys[keys.length - 1][keyName] !== undefined ? keys[keys.length - 1][keyName] : defaultValue;

    // 寻找区间
    let idx = 0;
    for (let i = 0; i < keys.length - 1; i++) {
        if (time >= keys[i].time && time < keys[i + 1].time) {
            idx = i;
            break;
        }
    }

    const k1 = keys[idx];
    const k2 = keys[idx + 1];
    let factor = (time - k1.time) / (k2.time - k1.time);

    // 贝塞尔或者 stepped 曲线处理
    if (k1.curve === 'stepped') {
        factor = 0;
    } else if (k1.curve !== undefined && k1.c2 !== undefined) {
        factor = solveBezier(factor, k1.curve, k1.c2, k1.c3, k1.c4);
    }

    const val1 = k1[keyName] !== undefined ? k1[keyName] : defaultValue;
    const val2 = k2[keyName] !== undefined ? k2[keyName] : defaultValue;

    return val1 + (val2 - val1) * factor;
}

// 求解贝塞尔因子，对缺省的贝塞尔控制坐标自动补 0 防止 NaN 运算
function solveBezier(x, c1, c2, c3, c4) {
    c1 = c1 !== undefined ? c1 : 0;
    c2 = c2 !== undefined ? c2 : 0;
    c3 = c3 !== undefined ? c3 : 0;
    c4 = c4 !== undefined ? c4 : 0;

    let t = 0.5;
    let min = 0.0;
    let max = 1.0;
    for (let i = 0; i < 8; i++) {
        const bx = 3 * (1 - t) * (1 - t) * t * c1 + 3 * (1 - t) * t * t * c3 + t * t * t;
        if (bx < x) {
            min = t;
        } else {
            max = t;
        }
        t = (min + max) * 0.5;
    }
    return 3 * (1 - t) * (1 - t) * t * c2 + 3 * (1 - t) * t * t * c4 + t * t * t;
}

// 动画核心应用函数
function applyAnimation(animName, time) {
    const anim = state.animations[animName];
    if (!anim) return;

    // 1. 还原所有骨骼Setup pose
    state.bones.forEach(b => b.reset());
    state.slots.forEach(s => {
        if (s.activeAttachment) s.activeAttachment.resetDeform();
    });
    state.drawOrder = [...state.slots];

    // 2. 应用骨骼 timelines (rotate, translate, scale)
    if (anim.bones) {
        Object.keys(anim.bones).forEach(boneName => {
            const bone = state.bonesByName[boneName];
            if (!bone) return;

            const channels = anim.bones[boneName];
            if (channels.rotate) {
                const animRot = getTimelineValue(channels.rotate, time, 0, 'angle');
                bone.rotation += animRot;
            }
            if (channels.translate) {
                const tx = getTimelineValue(channels.translate, time, 0, 'x');
                const ty = getTimelineValue(channels.translate, time, 0, 'y');
                bone.x += tx;
                bone.y += ty;
            }
            if (channels.scale) {
                const sx = getTimelineValue(channels.scale, time, 1, 'x');
                const sy = getTimelineValue(channels.scale, time, 1, 'y');
                bone.scaleX *= sx;
                bone.scaleY *= sy;
            }
        });
    }

    // 更新骨骼世界矩阵以获得IK需要的基础矩阵
    updateBonesHierarchy();

    // 3. 应用 IK constraints
    applyIkConstraints();

    // 4. 应用 DrawOrder timelines
    if (anim.drawOrder && anim.drawOrder.length > 0) {
        // 查找合适的时间帧
        let activeKey = null;
        for (let i = anim.drawOrder.length - 1; i >= 0; i--) {
            if (time >= (anim.drawOrder[i].time || 0)) {
                activeKey = anim.drawOrder[i];
                break;
            }
        }
        if (activeKey && activeKey.offsets) {
            const activeSlots = [...state.slots];
            activeKey.offsets.forEach(offsetObj => {
                const idx = activeSlots.findIndex(s => s.name === offsetObj.slot);
                if (idx !== -1) {
                    const targetIdx = idx + offsetObj.offset;
                    const [removed] = activeSlots.splice(idx, 1);
                    activeSlots.splice(targetIdx, 0, removed);
                }
            });
            state.drawOrder = activeSlots;
        }
    }

    // 5. 应用 Deform timelines (主要为衣领的褶动)
    if (anim.deform && anim.deform.default) {
        const slotsDeform = anim.deform.default;
        Object.keys(slotsDeform).forEach(slotName => {
            const slot = state.slotsByName[slotName];
            if (!slot || !slot.activeAttachment) return;
            
            const attachmentsDeform = slotsDeform[slotName];
            Object.keys(attachmentsDeform).forEach(attachName => {
                if (slot.activeAttachment.name !== attachName) return;

                const keys = attachmentsDeform[attachName];
                // 插值 Deform 偏移向量
                const deformOffsets = interpolateDeform(keys, time, slot.activeAttachment.flatWeights.length * 2);
                const offset = keys[0].offset || 0; // 支持 Timeline 的起始偏移
                slot.activeAttachment.applyDeform(offset, deformOffsets);
            });
        });
    }

    // 6. 为所有活跃的Mesh蒙皮重新计算世界坐标
    state.drawOrder.forEach(slot => {
        if (slot.activeAttachment) {
            slot.activeAttachment.updateWorldPositions(slot.bone, state.bones);
        }
    });
}

// 混合插值Deform偏移数组
function interpolateDeform(keys, time, count) {
    if (!keys || keys.length === 0) return new Array(count).fill(0);
    
    // 首尾快捷判断
    if (time <= keys[0].time) return keys[0].vertices || new Array(count).fill(0);
    if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].vertices || new Array(count).fill(0);

    let idx = 0;
    for (let i = 0; i < keys.length - 1; i++) {
        if (time >= keys[i].time && time < keys[i + 1].time) {
            idx = i;
            break;
        }
    }

    const k1 = keys[idx];
    const k2 = keys[idx + 1];
    let factor = (time - k1.time) / (k2.time - k1.time);
    
    if (k1.curve === 'stepped') {
        factor = 0;
    } else if (k1.curve !== undefined && k1.c2 !== undefined) {
        factor = solveBezier(factor, k1.curve, k1.c2, k1.c3, k1.c4);
    }

    const arr1 = k1.vertices || new Array(count).fill(0);
    const arr2 = k2.vertices || new Array(count).fill(0);

    const result = [];
    for (let i = 0; i < count; i++) {
        const val1 = arr1[i] !== undefined ? arr1[i] : 0;
        const val2 = arr2[i] !== undefined ? arr2[i] : 0;
        result.push(val1 + (val2 - val1) * factor);
    }
    return result;
}


// 5. 仿射变换三角形渲染器
function drawTexturedTriangle(ctx, img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    // 公式 (u, v) => (x, y)
    const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(den) < 0.0001) return; // 退化不渲染

    const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
    const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
    const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den;

    const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
    const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
    const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den;

    // 解决 Canvas 2D 贴图三角形拼接处的缝隙 (防锯齿虚边线)
    // 将三角形裁剪路径顶点稍微向外延伸 0.5 像素
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const pad = 0.5;

    let dx0 = x0 - cx, dy0 = y0 - cy;
    let len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    const px0 = len0 > 0.1 ? x0 + (dx0 / len0) * pad : x0;
    const py0 = len0 > 0.1 ? y0 + (dy0 / len0) * pad : y0;

    let dx1 = x1 - cx, dy1 = y1 - cy;
    let len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const px1 = len1 > 0.1 ? x1 + (dx1 / len1) * pad : x1;
    const py1 = len1 > 0.1 ? y1 + (dy1 / len1) * pad : y1;

    let dx2 = x2 - cx, dy2 = y2 - cy;
    let len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const px2 = len2 > 0.1 ? x2 + (dx2 / len2) * pad : x2;
    const py2 = len2 > 0.1 ? y2 + (dy2 / len2) * pad : y2;

    ctx.save();
    
    // 使用微调膨胀后的顶点作裁剪路径
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.closePath();
    ctx.clip();

    // 依然使用原顶点计算出来的仿射变换矩阵，保证贴图纹理不错位
    ctx.transform(a, b, c, d, e, f);
    
    // 渲染
    ctx.drawImage(img, 0, 0);

    ctx.restore();
}


// 6. 主画布绘制与骨骼可视化
function renderAll(ctx) {
    // 清屏，并附带CSS背景网格线
    ctx.clearRect(0, 0, 900, 720);

    // 平移到画布中央偏下方
    ctx.save();
    ctx.translate(450, 600);
    ctx.scale(state.scale, -state.scale); // Spine Y轴朝上，Canvas Y轴朝下，通过缩放反转

    // 渲染打工人
    state.drawOrder.forEach(slot => {
        const mesh = slot.activeAttachment;
        if (!mesh) return;

        const texture = state.textures[mesh.name];
        if (!texture) return;

        // 遍历所有三角形进行渲染
        const tris = mesh.triangles;
        const verts = mesh.vertices;
        const tw = mesh.width;
        const th = mesh.height;

        for (let i = 0; i < tris.length; i += 3) {
            const v0 = verts[tris[i]];
            const v1 = verts[tris[i + 1]];
            const v2 = verts[tris[i + 2]];

            // 仿射映射
            drawTexturedTriangle(
                ctx, texture,
                v0.worldX, v0.worldY,
                v1.worldX, v1.worldY,
                v2.worldX, v2.worldY,
                v0.u * tw, v0.v * th, // 直接映射，无需反转
                v1.u * tw, v1.v * th,
                v2.u * tw, v2.v * th
            );
        }
    });

    // 渲染骨骼骨架线 (如果开启)
    if (state.showBones) {
        drawSkeleton(ctx);
    }

    ctx.restore();
}

// 骨骼连线可视化
function drawSkeleton(ctx) {
    state.bones.forEach(bone => {
        // 主骨骼线
        const length = bone.length;
        const x1 = bone.worldX;
        const y1 = bone.worldY;
        
        // 算出骨骼末梢位置 (沿着本地X轴)
        const x2 = bone.a * length + bone.worldX;
        const y2 = bone.c * length + bone.worldY;

        const isHovered = (state.hoveredBone === bone.name);
        const isSelected = (state.selectedBone === bone.name);

        ctx.strokeStyle = isSelected ? '#06b6d4' : (isHovered ? '#10b981' : 'rgba(238, 242, 246, 0.45)');
        ctx.lineWidth = isSelected ? 4 : (isHovered ? 3.5 : 2);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 关节节点
        ctx.fillStyle = isSelected ? '#06b6d4' : (isHovered ? '#10b981' : '#f43f5e');
        ctx.beginPath();
        ctx.arc(x1, y1, isSelected ? 6.5 : (isHovered ? 5.5 : 4), 0, Math.PI * 2);
        ctx.fill();

        // 骨骼标签文本 (如果高亮)
        if (isHovered || isSelected) {
            ctx.save();
            ctx.scale(1, -1); // 翻转文字方向以便直观阅读
            ctx.fillStyle = '#ffffff';
            ctx.font = '13px Outfit, sans-serif';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(bone.name, x1 + 10, -y1 + 5);
            ctx.restore();
        }
    });
}

// 主渲染计时循环
let fpsLastTime = performance.now();
let fpsCount = 0;
function renderLoop(timestamp) {
    const elapsed = (timestamp - state.lastFrameTime) / 1000;
    state.lastFrameTime = timestamp;

    // 帧率计算
    fpsCount++;
    if (timestamp - fpsLastTime >= 1000) {
        document.getElementById('info-fps').textContent = fpsCount;
        fpsCount = 0;
        fpsLastTime = timestamp;
    }

    if (state.spineData && state.isPlaying) {
        // 累加时间并取余循环
        const activeAnimData = state.animations[state.activeAnimation];
        if (activeAnimData) {
            // 使用预先计算好的动作持续时间
            const maxDur = activeAnimData.duration || 1.0;
            
            document.getElementById('info-dur').textContent = maxDur.toFixed(2);

            // 更新播放时间
            state.time += elapsed * state.speed;
            if (state.time >= maxDur) {
                state.time = state.time % maxDur; // 循环
            }
            
            // 应用动画帧数据并渲染
            applyAnimation(state.activeAnimation, state.time);
        }
    }

    const canvas = document.getElementById('main-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        renderAll(ctx);
    }

    requestAnimationFrame(renderLoop);
}


// 7. 交互控制与 sidebar UI 绑定
function setupUI() {
    // 播放速度
    const rSpeed = document.getElementById('r-speed');
    const vSpeed = document.getElementById('v-speed');
    rSpeed.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        vSpeed.textContent = state.speed.toFixed(1);
    });

    // 缩放滑块
    const rScale = document.getElementById('r-scale');
    const vScale = document.getElementById('v-scale');
    rScale.addEventListener('input', (e) => {
        state.scale = parseFloat(e.target.value);
        vScale.textContent = state.scale.toFixed(2);
    });

    // 播放与暂停按钮
    const btnPlay = document.getElementById('btn-play');
    btnPlay.addEventListener('click', () => {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            btnPlay.textContent = '⏸️ 暂停';
            btnPlay.classList.remove('paused');
        } else {
            btnPlay.textContent = '▶️ 播放';
            btnPlay.classList.add('paused');
        }
    });

    // 显示骨骼按钮
    const btnBones = document.getElementById('btn-bones');
    btnBones.addEventListener('click', () => {
        state.showBones = !state.showBones;
        if (state.showBones) {
            btnBones.classList.add('active');
        } else {
            btnBones.classList.remove('active');
        }
    });

    // 动作切换下拉框
    const animSelect = document.getElementById('anim-select');
    animSelect.addEventListener('change', (e) => {
        state.activeAnimation = e.target.value;
        state.time = 0; // 从头播放新动作
    });

    // 角色切换下拉框
    const charSelect = document.getElementById('char-select');
    charSelect.addEventListener('change', (e) => {
        state.activeCharacter = e.target.value;
        if (state.activeCharacter === 'salaryman') {
            generateTextures(state.suitColor);
        } else {
            loadAssassinTextures();
        }
    });

    // 西装颜色卡片选择切换 (实时重绘纹理，绝无毛边)
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            swatches.forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            state.suitColor = swatch.getAttribute('data-color');
            if (state.activeCharacter === 'salaryman') {
                generateTextures(state.suitColor);
            }
        });
    });

    // 绑定鼠标移入Canvas选择骨骼交互
    const canvas = document.getElementById('main-canvas');
    canvas.addEventListener('mousemove', (e) => {
        if (!state.showBones || state.bones.length === 0) return;
        
        // 获取鼠标相对 Canvas 的坐标
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 逆向变换转换至 Spine 世界空间坐标系统 (对应中央平移与缩放)
        const spineX = (mx - 450) / state.scale;
        const spineY = -(my - 600) / state.scale;

        // 寻找距离最近的关节
        let minD = 20; // 选定半径距离 (单位: Spine 像素)
        let foundBone = null;
        
        state.bones.forEach(bone => {
            const bx = bone.worldX;
            const by = bone.worldY;
            const d = Math.sqrt((spineX - bx) ** 2 + (spineY - by) ** 2);
            if (d < minD) {
                minD = d;
                foundBone = bone;
            }
        });

        if (foundBone) {
            if (state.hoveredBone !== foundBone.name) {
                state.hoveredBone = foundBone.name;
                highlightTreeNode(foundBone.name);
            }
        } else {
            if (state.hoveredBone) {
                state.hoveredBone = null;
                highlightTreeNode(null);
            }
        }
    });

    canvas.addEventListener('click', () => {
        if (state.hoveredBone) {
            state.selectedBone = state.hoveredBone;
            highlightTreeNode(state.selectedBone, true);
        } else {
            state.selectedBone = null;
            highlightTreeNode(null, true);
        }
    });
}

// 可视化骨骼树 UI 构建
function buildBoneTreeUI() {
    const treeScroll = document.getElementById('bone-tree');
    if (!treeScroll) return;
    treeScroll.innerHTML = '';

    // 查找所有的根骨骼 (一般只有 root 一个)
    const roots = state.bones.filter(b => !b.parent);
    roots.forEach(rootBone => {
        treeScroll.appendChild(createBoneNodeEl(rootBone));
    });
}

// 递归渲染树节点
function createBoneNodeEl(bone) {
    const node = document.createElement('div');
    node.className = 'tree-node';

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.setAttribute('data-bone-name', bone.name);
    label.textContent = '🦴 ' + bone.name;

    // Hover 交互同步
    label.addEventListener('mouseenter', () => {
        state.hoveredBone = bone.name;
    });
    label.addEventListener('mouseleave', () => {
        if (state.hoveredBone === bone.name) state.hoveredBone = null;
    });
    label.addEventListener('click', () => {
        state.selectedBone = (state.selectedBone === bone.name) ? null : bone.name;
        highlightTreeNode(state.selectedBone, true);
    });

    node.appendChild(label);

    if (bone.children.length > 0) {
        bone.children.forEach(child => {
            node.appendChild(createBoneNodeEl(child));
        });
    }

    return node;
}

// 联动侧边栏与Canvas的骨骼树高亮
function highlightTreeNode(boneName, isSelect = false) {
    const labels = document.querySelectorAll('.tree-label');
    labels.forEach(l => {
        const name = l.getAttribute('data-bone-name');
        if (name === boneName) {
            l.classList.add('hi');
            if (isSelect) {
                // 滚动至视图中
                l.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } else {
            if (!isSelect || name !== state.selectedBone) {
                l.classList.remove('hi');
            }
        }
    });
}


// 启动项
window.addEventListener('DOMContentLoaded', () => {
    // 建立 UI 控制事件
    setupUI();
    
    if (state.activeCharacter === 'salaryman') {
        generateTextures(state.suitColor);
    } else {
        loadAssassinTextures();
    }
    
    // 开始拉取并执行 Spine 动画引擎
    initSpine();
});
