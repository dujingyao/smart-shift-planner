// --- 完整后端代码 index.js (V2.7 智谱视觉究极版) ---

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');

const app = express();
app.use(cors()); 
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ------------------------------------
// --- 【后端内存数据库】 ---
// ------------------------------------
const plansDatabase = {
  "ABCD12": {
    totalSlots: 10,
    slotRequirements: { "0-3": 2, "0-4": 1, "2-7": 3, "2-8": 3, "4-1": 1, "4-2": 2 },
    memberConstraints: { min: 1, max: 3 },
    currentSignups: { "0-3": 1, "2-7": 3, "4-1": 0, "4-2": 1 },
    finalRoster: [] 
  }
};

// ------------------------------------
// --- 【API 1: 验证队长码】 ---
// ------------------------------------
app.get('/api/plan/verify/:captainCode', (req, res) => {
  const plan = plansDatabase[req.params.captainCode];
  if (plan) res.status(200).json({ message: "验证成功！", planDetails: plan });
  else res.status(404).json({ error: "队长码无效" });
});

// ------------------------------------
// --- 【API 2: 创建新计划】 ---
// ------------------------------------
app.post('/api/plan/create', (req, res) => {
  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  plansDatabase[newCode] = { ...req.body, currentSignups: {}, finalRoster: [] };
  console.log(`--- [后端] 创建成功! 新队长码: ${newCode} ---`);
  res.status(201).json({ captainCode: newCode });
});

// ------------------------------------
// --- 【API 3: 智谱视觉大模型真实解析 (CSV提示词增强版)】 ---
// ------------------------------------
app.post('/api/member/parse-schedule', upload.single('file'), async (req, res) => {
  console.log('--- [后端] 收到真实课表图片，正在启动智谱视觉大模型 (GLM-4V)... ---');

  if (!req.file) return res.status(400).json({ error: "没有收到图片文件" });

  const systemPrompt = `# Role
你是一个极其严谨的坐标测绘与表格解析专家。你的任务是将图片中的“彩色实体区块”，极其精准地映射为二维网格坐标。

# Core Rules (绝对不容许看错行列！)
1. 忽略所有课程名字和地点。你的眼里只有“有颜色的色块”。纯白色的格子代表无课，直接跳过。
2. **列定位（星期）**：图片顶部是表头，严格划分为【周一、周二、周三、周四、周五、周六、周日】。
3. **行定位（节次）**：图片最左侧是数字【1, 2, 3, 4, 5, 6, 7, 8...】。
4. **防错警告**：由于网格线可能不清晰，你必须用虚拟的水平线严格对齐最左侧的数字，绝不能把第7行看成第5行，也绝不能把周三的课串行到周二！

# Execution Steps (强制执行顺序)
你必须在内心中，严格按照以下步骤逐列扫描：
- 第1步：目光死死锁定“周一”这一列，从上往下扫，记录有颜色的行号（例如跨越1、2行，记为[1-2]）。
- 第2步：目光平移到“周二”这一列，从上往下扫，记录有颜色的行号。
- 第3步：依次类推，直到扫描完周日。

# Output Format
严格遵守以下要求，不得有任何偏差：
1. 必须且只能输出一个 Markdown 代码块，语言标记为 \`csv\`。
2. 绝对不准输出任何问候、解释或总结。
3. 严格输出两列，格式为 \`<星期>[<开始节次>-<结束节次>]\`。

\`\`\`csv
状态,节次
有课,周一[1-2]
有课,周一[7-8]
有课,周二[1-2]
有课,周二[5-6]
有课,周三[1-2]
有课,周三[3-4]
有课,周三[5-6]
有课,周三[7-8]
有课,周四[3-4]
有课,周五[1-2]
\`\`\``;


  try {
    const base64Image = req.file.buffer.toString('base64');
    const response = await axios.post(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        model: "glm-4v-flash", 
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${base64Image}` } }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // ⚠️⚠️⚠️【非常重要】：请换成你刚刚申请的智谱 API Key！
          'Authorization': 'Bearer 8777090f3ddb47329990c4f237dcb5e0.IHrljSAuOjTMPF50' 
        }
      }
    );

    const aiReplyString = response.data.choices[0].message.content;
    console.log("--- [后端] 智谱大模型原始返回： ---\n", aiReplyString);

    let csvData = aiReplyString;
    const csvMatch = aiReplyString.match(/```csv\n([\s\S]*?)\n```/);
    if (csvMatch) csvData = csvMatch[1];

    const busySlots = [];
    const dayMap = { '周一': 0, '周二': 1, '周三': 2, '周四': 3, '周五': 4, '周六': 5, '周日': 6 };
    const lines = csvData.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 2) {
        const timeMatch = parts[1].match(/(周.)\[(\d+)-(\d+)\]/);
        if (timeMatch) {
          const dayIndex = dayMap[timeMatch[1]];
          if (dayIndex !== undefined) {
            for (let s = parseInt(timeMatch[2]); s <= parseInt(timeMatch[3]); s++) {
              busySlots.push(`${dayIndex}-${s}`);
            }
          }
        }
      }
    }

    console.log("--- [后端] 翻译给前端的数组： ---", busySlots);
    res.status(200).json({ busy: busySlots, available: [] });

  } catch (error) {
    console.error("--- [后端] 呼叫失败 ---", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "图片解析失败" });
  }
});

// --- 【API 4: 队员最终提交选班 (防超卖)】 ---
// ------------------------------------
app.post('/api/member/submit', (req, res) => {
  const { captainCode, name, phone, selectedSlots } = req.body;
  const plan = plansDatabase[captainCode];
  if (!plan) return res.status(404).json({ error: "计划不存在" });

  let hasConflict = false;
  for (const slotId of selectedSlots) {
    if ((plan.currentSignups[slotId] || 0) >= (plan.slotRequirements[slotId] || 0)) {
      hasConflict = true; 
    }
  }

  if (hasConflict) return res.status(409).json({ error: "手慢了！部分时段已被别人抢先提交" });

  selectedSlots.forEach(id => { plan.currentSignups[id] = (plan.currentSignups[id] || 0) + 1; });
  if (!plan.finalRoster) plan.finalRoster = [];
  plan.finalRoster.push({ name, phone, selectedSlots, submitTime: new Date().toLocaleString() });

  res.status(200).json({ message: "提交成功！" });
});

// ------------------------------------
// --- 【API 5: 队长仪表盘数据】 ---
// ------------------------------------
app.get('/api/plan/dashboard/:captainCode', (req, res) => {
  const plan = plansDatabase[req.params.captainCode];
  if (!plan) return res.status(404).json({ error: "找不到该排班计划" });
  res.status(200).json({
    totalSlots: plan.totalSlots,
    slotRequirements: plan.slotRequirements,
    currentSignups: plan.currentSignups,
    finalRoster: plan.finalRoster || [] 
  });
});

// --- 这就是你可能不小心删掉的“打工店员”代码！ ---
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`--- [后端] V2.7 (智谱视觉究极版) 已启动 http://localhost:${PORT} ---`);
});