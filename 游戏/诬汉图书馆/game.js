const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameInfo = document.getElementById("gameInfo");

const ReadImg = new Image();
const ScratchImg = new Image();
const BadendImg = new Image();
const PhoneImg = new Image();
const PhoneRecordImg = new Image();

let gWidth = 0;
let gHeight = 0;
let gRatio = 0; // 计算图片宽高比

// ---- 游戏配置 ----
const scoreSpeed = 0.01;
const scoreDecSpeed = 0.005;
const difficultySpeed = 0.00002; // 难度增加速度
const maxDifficulty = 10; // 最大难度
const recordBaseInterval = 5000; // 基础录像间隔时间（毫秒）
const recordRandomRange = 3000; // 录像间隔的随机范围（毫秒）
const recordBaseDuration = 3000; // 基础录像持续时间（毫秒）
const recordRandomDuration = 2000; // 录像持续时间的随机范围（毫秒）
const phoneMoveBaseSpeed = 0.0003; // 手机移动的基础速度 (0.0003)
const phoneMoveMaxSpeed = 0.003; // 手机移动的最大速度
const lineHeight = 0.784; // 录像线高度占画布高度的比例

// ---- 运行变量 ----
let isHolding = false;
let gameStage = 0; // 0: 开始界面, 1: 游戏进行中, 2: 游戏结束
let gameStartTime = Date.now(); // 游戏开始时间
let gameEndTime = 0; // 游戏结束时间
let gameScore = 0;
let gameDifficulty = 1; // 游戏难度，决定手机录像的速度和频率

let player_isScratch = false; // 玩家是否在抓
let stalker_recordingStage = 0; // 0: 未开始录像, 1: 准备录像, 2: 录像中, 3: 收回中
let phoneHPs = 0; // 手机高度的百分比，为0时隐藏，为1时接触录像线

canvas.addEventListener("pointerdown", () => {
  isHolding = true;
});
canvas.addEventListener("pointerup", () => {
  isHolding = false;
});
canvas.addEventListener("pointerleave", () => {
  isHolding = false;
});

let canvasRectUV = { x: 0, y: 0, width: 1, height: 1 };

// 主循环
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

let lastUpdateTime = Date.now();
let nextRecordTime = getNextRecordTime(); // 下一个录像时间
let recordEndTime = getRecordEndTime(nextRecordTime); // 录像结束时间
let currentDifficulty = 1; // 当前难度，防止在录像期间游戏难度动态变化

function update() {
  // 获取Δt
  let now = Date.now();
  let deltaTime = now - lastUpdateTime;
  lastUpdateTime = now;

  // 初始界面
  if (gameStage === 0) {
    gameInfo.innerHTML = "点击屏幕开始游戏<div id='controlHint'>操作：在录像按键接触横线前按住避免被拍</div>";
  }
  // 开始游戏
  if (gameStage === 0 && isHolding) {
    gameStage = 1;
    gameStartTime = Date.now();
  }
  // 游戏进行中
  if (gameStage === 1) {
    player_isScratch = !isHolding; // 玩家是否在抓
    gameInfo.innerHTML = "<div id='hud'>分数：" + gameScore.toFixed(0) + " | 难度：" + gameDifficulty.toFixed(1) + " | 时长：" + ((Date.now() - gameStartTime) / 1000).toFixed(0) + "秒</div>";
    // 更新游戏难度
    gameDifficulty += deltaTime * difficultySpeed; // 难度随时间增加
    // 抓痒和不抓痒时分数变化
    if (!isHolding) {
      gameScore += deltaTime * scoreSpeed; // 松开时分数缓慢增加
    } else {
      gameScore -= deltaTime * scoreDecSpeed; // 按住时分数缓慢减少
      if (gameScore < 0) {
        gameScore = 0; // 分数不能为负
      }
    }
    // 定时开始偷拍
    if (Date.now() > nextRecordTime && stalker_recordingStage === 0) {
      // 开始录像
      console.log("准备录像");
      stalker_recordingStage = 1;
      currentDifficulty = gameDifficulty; // 记录当前难度
    }
    // 准备录像
    if (stalker_recordingStage === 1) {
      // 计算手机高度百分比
      phoneHPs += deltaTime * phoneMoveBaseSpeed * currentDifficulty; // 手机高度随时间增加
      if (phoneHPs >= 1) {
        phoneHPs = 1; // 手机高度不能超过1
        stalker_recordingStage = 2; // 开始录像
        recordEndTime = getRecordEndTime(nextRecordTime); // 获取录像结束时间
        console.log("开始录像，结束时间:", new Date(recordEndTime).toLocaleTimeString());
      }
    }
    // 录像中
    else if (stalker_recordingStage === 2) {
      if (!isHolding) {
        // 如果没有按住则游戏失败
        console.log("游戏失败，未按住录像线");
        gameStage = 2; // 游戏结束.
        gameEndTime = Date.now();
        gameInfo.innerHTML = "<div class='end'>这世界上又多了一个被诬告的人</div>" + gameInfo.innerHTML;
      }
      // 正常按住的情况
      if (now > recordEndTime) {
        // 录像结束
        console.log("录像结束");
        stalker_recordingStage = 3; // 开始收回手机
      }
    }
    // 收回手机
    else if (stalker_recordingStage === 3) {
      phoneHPs -= deltaTime * phoneMoveBaseSpeed * currentDifficulty; // 手机高度随时间减少
      if (phoneHPs <= 0) {
        phoneHPs = 0; // 手机高度不能小于0
        stalker_recordingStage = 0; // 重置录像状态
        nextRecordTime = getNextRecordTime(); // 获取下一个录像时间
      }
    }
  }
}

function draw() {
  let canvasRect = { x: window.innerWidth * canvasRectUV.x, y: window.innerHeight * canvasRectUV.y, width: window.innerWidth * canvasRectUV.width, height: window.innerHeight * canvasRectUV.height };
  canvas.width = canvasRect.width;
  canvas.height = canvasRect.height;

  let scale = Math.min(canvas.width / gWidth, canvas.height / gHeight);
  let sWidth = gWidth * scale;
  let sHeight = gHeight * scale;
  
  let offsetX_main = (canvas.width - gWidth * scale) / 2;

  // 绘制玩家是否在抓
  if (gameStage < 2) {
    ctx.drawImage(player_isScratch ? ScratchImg : ReadImg, offsetX_main, 0, ReadImg.width * scale, ReadImg.height * scale);
  } else {
    ctx.drawImage(BadendImg, offsetX_main, 0, ReadImg.width * scale, ReadImg.height * scale);
  }

  // 绘制手机背景

  // 绘制手机
  let phoneShiftY = (1 - (stalker_recordingStage >= 1 ? phoneHPs : 0)) * PhoneImg.height * scale; // 如果正在录像，手机向上偏移
  ctx.drawImage(
    stalker_recordingStage === 2 ? PhoneRecordImg : PhoneImg,
    offsetX_main + gWidth * scale - PhoneImg.width * scale,
    sHeight - PhoneImg.height * scale + phoneShiftY,
    PhoneImg.width * scale,
    PhoneImg.height * scale
  );

  // 绘制录像线
  if (gameStage === 1) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; // 红色半透明
    ctx.fillRect(offsetX_main, sHeight * lineHeight, sWidth, 2); // 绘制横线
  }
}

function getNextRecordTime() {
  // 计算下一个录像时间
  let randomOffset = Math.random() * recordRandomRange - recordRandomRange / 2;
  return Date.now() + (recordBaseInterval + randomOffset) / gameDifficulty;
}
function getRecordEndTime() {
  let randomOffset = Math.random() * recordRandomDuration - recordRandomDuration / 2;
  // 计算录像结束时间
  return Date.now() + (recordBaseDuration + randomOffset) / gameDifficulty;
}

// 伪随机 - 备用
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 加载图片，完成后开始游戏 ----
let imagesLoaded = 0;
function checkAllImagesLoaded() {
  imagesLoaded++;
  if (imagesLoaded === 5) {
    // 所有图片加载完毕，开始游戏
    gWidth = ReadImg.width;
    gHeight = ReadImg.height;
    gRatio = gWidth / gHeight;
    console.log("所有图片已加载，宽高比:", gRatio);
    gameLoop(); // ✅ 现在才开始运行
  }
}

ReadImg.onload = checkAllImagesLoaded;
ReadImg.src = "Read.webp";
ScratchImg.onload = checkAllImagesLoaded;
ScratchImg.src = "Scratch.webp";
BadendImg.onload = checkAllImagesLoaded;
BadendImg.src = "BadEnd.webp";
PhoneImg.onload = checkAllImagesLoaded;
PhoneImg.src = "Phone.webp";
PhoneRecordImg.onload = checkAllImagesLoaded;
PhoneRecordImg.src = "PhoneRecord.webp";
