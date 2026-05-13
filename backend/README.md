# H5问卷系统 - 后端服务

Node.js + Express + SQLite 轻量后端，支持问卷提交、数据分析和 CSV 导出。

## 快速启动

```bash
cd backend
npm install
npm start
```

服务启动后访问 http://localhost:3000

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |

## API 接口

### POST /api/submit
提交问卷数据。

**请求体 (JSON):**
```json
{
  "q1": "A",
  "q2": "B",
  "q3": "C",
  "q4": "D",
  "q5": "A",
  "q6": "B",
  "q7": "C",
  "q8": "D",
  "q9": "A",
  "q10": "B",
  "q11": "C",
  "q12": "D",
  "q13": "A",
  "q14_object": "一棵树",
  "q14_adjective": "坚韧的",
  "q15_moment": "某个夏天的傍晚",
  "q16_drawing": "data:image/png;base64,..."
}
```

**响应:**
```json
{ "success": true, "id": 1 }
```

### GET /api/responses
获取所有问卷回答（后台管理用）。

**响应:**
```json
{
  "success": true,
  "count": 42,
  "data": [...]
}
```

### GET /api/responses/:id
获取单条回答详情（含分析维度）。

**响应包含额外字段:**
- `emotional_type`: 情感分析类型
- `behavioral_type`: 行为分析类型

### GET /api/stats
获取聚合统计数据。

**响应结构:**
```json
{
  "success": true,
  "totalResponses": 42,
  "questionStats": {
    "q1": {
      "counts": { "A": 10, "B": 12, "C": 8, "D": 12 },
      "percentages": { "A": 23.81, "B": 28.57, "C": 19.05, "D": 28.57 }
    }
  },
  "emotionalAnalysis": {
    "counts": { "漂泊型": 5, "挣扎型": 8, "沉稳型": 12, "探索型": 10, "未分类": 7 },
    "percentages": { ... }
  },
  "behavioralAnalysis": {
    "counts": { "数字游牧": 6, "社交活跃": 9, "内向沉淀": 11, "生活主义": 8, "未分类": 8 },
    "percentages": { ... }
  }
}
```

### GET /api/export
导出 CSV 文件（含情感/行为分析字段，不含 drawing 数据）。

## 分析维度

### 情感分析（基于 q9-q12）
| 类型 | 条件 |
|------|------|
| 漂泊型 | q12=A 且 (q11=A 或 q10=D) |
| 挣扎型 | q11=C 且 (q10=A 或 q9=D) |
| 沉稳型 | q12=D 且 (q11=D 或 q10=C) |
| 探索型 | (q12=B 或 q12=C) 且 (q10=B 或 q11=B) |
| 未分类 | 不满足以上条件 |

### 行为分析（基于 q4-q9）
| 类型 | 条件 |
|------|------|
| 数字游牧 | q4=A 且 (q5=D 或 q8=A) |
| 社交活跃 | (q8=C 或 q8=D) 且 (q7=C 或 q7=D) |
| 内向沉淀 | q8=A 且 q9=D 且 (q5=A 或 q5=B) |
| 生活主义 | q5=C 且 (q4=B 或 q6=D) |
| 未分类 | 不满足以上条件 |

## 项目结构

```
backend/
├── server.js          # 主入口
├── package.json       # 依赖配置
├── questionnaire.db   # SQLite 数据库（自动创建）
└── README.md          # 本文件
```

## 技术栈
- **Express** — Web 框架
- **better-sqlite3** — SQLite 驱动（同步 API，性能优秀）
- **cors** — 跨域支持
