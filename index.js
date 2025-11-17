// --- 复制后端代码 index.js (V2.0 全栈版) ---

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors()); 
app.use(express.json());

// ------------------------------------
// --- 【【 V2.0 核心：“假”数据库 】】 ---
// ------------------------------------
// 我们用一个 JS 对象来当“内存数据库”
// key = 队长码 (e.g., "ABCD12")
// value = 队长设置的排班详情
const plansDatabase = {
  // 我们预置一个 "ABCD12"，让 VUE 前端的“假装”逻辑
  // (比如 CaptainHome) 还能继续工作
  "ABCD12": {
    totalSlots: 10,
    slotRequirements: { "0-3": 2, "0-4": 1, "2-7": 3, "2-8": 3, "4-1": 1, "4-2": 2 },
    memberConstraints: { min: 1, max: 3 },
    // (我们还需要“已报名”数据...)
    currentSignups: { "0-3": 1, "2-7": 3, "4-1": 0, "4-2": 1 }
  }
};
// ------------------------------------


// --- 1. 【【 V2.0 升级：GET API 】】 ---
// (GET /api/plan/verify/:captainCode)
// (它现在会查“数据库”了！)
app.get('/api/plan/verify/:captainCode', (req, res) => {
  const code = req.params.captainCode;
  console.log(`--- [后端] 接到 GET 请求：正在验证队长码: ${code} ---`);

  // 【核心修改】
  // 不再是 if (code === 'ABCD12')
  // 而是...
  const planDetails = plansDatabase[code];

  if (planDetails) {
    // (A) 如果在“数据库”里找到了...
    console.log(`--- [后端] 验证成功! 找到了 ${code} 的计划。---`);
    res.status(200).json({
      message: "验证成功！(来自 V2.0 真实后端！)",
      // 【核心】把数据库里的数据发回去！
      planDetails: planDetails 
    });
    
  } else {
    // (B) 如果没找到...
    console.log(`--- [后端] 验证失败! ${code} 不存在。---`);
    res.status(404).json({
      error: "队长码无效或已过期 (来自 V2.0 真实后端！)"
    });
  }
});


// --- 2. 【【 V2.0 新增：POST API 】】 ---
// (POST /api/plan/create)
// (它会“写入”数据库！)
app.post('/api/plan/create', (req, res) => {
  // 1. "req.body" 就是 VUE 前端用 Axios POST 过来的
  //    "dataToSend" (JSON)
  const data = req.body;
  
  console.log('--- [后端] 接到 POST 请求：正在创建新计划... ---');
  console.log('--- [后端] 收到数据:', data);

  // 2. “假装”生成一个唯一的队长码
  // (一个简单的 6 位随机字母/数字)
  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // 3. 【核心】把新计划“存入”我们的“数据库”
  // (我们还需要为新计划初始化“已报名”数据)
  plansDatabase[newCode] = {
    ...data, // (这包含了 totalSlots, slotRequirements, memberConstraints)
    currentSignups: {} // (一个新计划，已报名人数=0)
  };
  
  // 4. 把“新”的队长码返回给前端
  console.log(`--- [后端] 计划创建成功! 新队长码: ${newCode} ---`);
  res.status(201).json({ // 201 = "Created"
    captainCode: newCode 
  });
});


// --- (旧的) 启动服务器 ---
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`--- [后端] V2.0 发动机已启动！---`);
  console.log(`--- [后端] 正在监听 http://localhost:${PORT} ---`);
});

// --- 复制结束 ---