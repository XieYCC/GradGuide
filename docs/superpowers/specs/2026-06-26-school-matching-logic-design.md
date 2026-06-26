# GradGuide 选校匹配逻辑设计 v1

## 概述

将当前静态/tier 硬编码的选校逻辑升级为基于用户个人档案的实时匹配系统。
整体采用「云端预计算 + 数据库缓存」模式：用户保存个人信息后，

- `saveProfile` 自动触发匹配计算
- 结果存入 `users.matchResult`
- 选校页直接读取缓存，无需重新计算

## 数据模型

### programs 集合新增字段

```json
{
  "selectivityBand": "elite" | "high" | "mid" | "friendly"
}
```

兜底逻辑（当字段不存在时）：

```js
function getSelectivityBand(program) {
  if (program.selectivityBand) return program.selectivityBand
  if (program.tier === 'reach' && /#\d{1,2}/.test(program.rank)) return 'elite'
  if (program.tier === 'reach') return 'high'
  if (program.tier === 'match' && /#\d{1,3}/.test(program.rank)) return 'mid'
  return 'friendly'
}
```

### 当前 21 条 programs selectivityBand 分配

| 项目 | selectivityBand |
|---|---|
| CMU CS | elite |
| Columbia CS | high |
| USC CS | mid |
| NEU CS | mid |
| Stevens CS | friendly |
| HKU CS | elite |
| CUHK CS | mid |
| HKUST CS | mid |
| Cambridge CS | elite |
| IC CS | elite |
| Edinburgh CS | mid |
| KCL CS | friendly |
| Northwestern MKT | elite |
| NYU MKT | high |
| BU MKT | mid |
| HKU MKT | high |
| CUHK MKT | mid |
| CityU MKT | friendly |
| LSE MKT | elite |
| Manchester MKT | mid |
| Warwick MKT | friendly |

### users 集合新增字段

```json
{
  "matchResult": {
    "version": "v1",
    "calculatedAt": "<Date>",
    "profileHash": "md5_of_profile",
    "reach": [ /* 项目完整对象 + fitScore + reasons */ ],
    "match": [ /* ... */ ],
    "safety": [ /* ... */ ]
  },
  "matchResultUpdatedAt": "<Date>"
}
```

## 算法流程

```text
saveProfile 触发计算
  ↓
读取 users.profile
  ↓
读取 programs（按 major/region 筛选）
  ↓
根据院校等级做候选池过滤
  ↓
逐个项目计算 fitScore
  ↓
分档：50-70 reach / 70-80 match / 80-90 safety
  ↓
写入 users.matchResult
  ↓
选校页读取缓存并展示
```

### 院校等级候选池规则

```js
const BAND_MAP = {
  '985 · C9 联盟': { visible: ['elite','high','mid','friendly'], extremeReach: [] },
  '985':            { visible: ['high','mid','friendly'],       extremeReach: ['elite'] },
  '211':            { visible: ['mid','friendly'],              extremeReach: ['elite','high'] },
  '双一流':          { visible: ['mid','friendly'],              extremeReach: ['high'] },
  '海外本科':        { visible: ['high','mid','friendly'],       extremeReach: ['elite'] },
  '中外合办':        { visible: ['mid','friendly'],              extremeReach: ['high'] },
  '双非一本':        { visible: ['mid','friendly'],              extremeReach: ['high'] },
  '双非二本':        { visible: ['friendly'],                   extremeReach: ['mid'] }
}
```

### 极限冲刺条件

宽松条件，满足任一即可：

- GPA >= 3.5
- TOEFL >= 100
- GRE >= 320
- 有科研且实习

限制：最多 2 个越级项目进入候选池。

## fitScore 分数模型 v1

### 总分结构

> fitScore = 标化基础分 + 院校匹配分 + GPA 匹配分 + 背景加分 + 偏好加分

clamp 到 [0, 95]。

### 1. 标化基础分（0-60）

达标给 60：

- TOEFL：每差 2 分扣 1 分
- GRE（仅强 GRE 项目）：每差 5 分扣 1 分
- `gre` 为 `不需要` / `可选` / 空时，GRE 不扣分

### 2. 院校匹配分（-10 ~ +12）

| 情况 | 分 |
|---|---|
| 用户院校等级 ≥ 项目层级 | +12 |
| 高一级 | +8 |
| 高两级 | +2 |
| 越级进入 | -8 |
| 其他 | -4 |

### 3. GPA 匹配分（-5 ~ +10）

| 差距（与 avgGpa） | 分 |
|---|---|
| ≥ +0.3 | +10 |
| ≥ +0.1 | +6 |
| ±0.1 以内 | +4 |
| ≥ -0.3 | 0 |
| < -0.3 | -5 |

### 4. 科研/实习背景分（0 ~ +8）

CS/DS 类：科研 × 2.5/每段 + 实习 × 1.5/每段（上限 8）
MKT/BA 类：实习 × 2.5/每段 + 科研 × 1.5/每段（上限 8）
其他：均衡（各 × 2/每段，上限 8）

### 5. 目标偏好加分（0 ~ +5）

- 目标地区匹配：+2
- 目标专业匹配：+2
- 优先级匹配：+1

## 返回结果结构

```json
{
  "reach": [
    {
      "fitScore": 65,
      "reasons": ["语言成绩达标", "GPA 接近项目平均"],
      "risks": ["GRE 略低于项目要求"],
      "isExtremeReach": false
    }
  ],
  "match": [],
  "safety": [],
  "extremeReachCount": 1
}
```

每个分档内按 fitScore 降序排列。

## 推荐理由

| 模块状态 | 理由文本 |
|---|---|
| 标化达标 | 语言成绩达标 |
| 标化略低 | TOEFL 差 X 分 / GRE 差 X 分 |
| 院校等级匹配 | 院校背景适合该项目层级 |
| 院校等级越级 | 院校背景稍弱，但其他条件有竞争力 |
| GPA 高 | GPA 高于项目平均 |
| GPA 低 | GPA 偏低 |
| 有科研 | X 段科研经历 |
| 有实习 | X 段实习经历 |
| 目标匹配 | 目标地区/专业匹配 |
| 极限冲刺 | 极限冲刺，作为 dream school |

## 错误处理

### saveProfile 计算失败

不影响主流程，matchResult 下次保存时重新计算。

### 选校页读取 matchResult 为空

前端自动调用 `matchPrograms` 云函数触发一次计算，然后重新读取。

### matchPrograms 云函数失败

展示重试按钮。用户可选择「使用本地估算结果」降级。

### 用户无个人档案

展示引导文案「请先完成个人信息填写」，同时展示全部 programs 列表兜底。

## v2 数量分配策略

### 背景

v1 后期临时改成固定排序切分：

```js
sorted.slice(0, 2)    // 冲刺
sorted.slice(2, 12)   // 匹配
sorted.slice(12, 17)  // 保底
```

这个方案能保证数量，但会破坏档位语义：低分项目可能因为排名位置被放进保底，高选择性 elite 项目也可能误入保底。

v2 采用「分数倾向分桶 + 目标数量补齐」策略，既保留三档语义，又尽量输出稳定数量。

### 目标数量

```js
const TARGET_COUNTS = {
  reach: { min: 2, ideal: 3, max: 3 },
  match: { min: 8, ideal: 10, max: 10 },
  safety: { min: 3, ideal: 4, max: 5 }
}
```

默认目标：冲刺 3、匹配 10、保底 4。项目库不足时允许低于最小值，但不允许为了凑数把明显不合适的项目强行塞入错误档位。

### 初始倾向分桶

先按 `fitScore` 放入倾向池：

```js
if (fitScore >= 80) safetyPool.push(program)
else if (fitScore >= 70) matchPool.push(program)
else reachPool.push(program)
```

这些池子只表示初始倾向，不是最终输出。

### 池内排序

所有池子都优先考虑目标匹配，然后按分数排序：

1. 目标地区/专业匹配优先
2. `fitScore` 高优先

保底池额外排序：

1. `friendly` / `mid` 优先
2. `high` / `elite` 靠后

避免 elite 项目被误标为保底。

### 第一轮取数

```js
reach = take(reachPool, 3)
match = take(matchPool, 10)
safety = take(safetyPool, 4)
```

### 补齐规则

#### 冲刺不足

从匹配池低分段补：

```js
reach 补充来源：matchPool 中 fitScore 较低的项目
```

这些项目接近冲刺边界。

#### 匹配不足

从两侧补：

```js
match 补充来源：
1. reachPool 中 fitScore 较高的项目
2. safetyPool 中 fitScore 较低的项目
```

#### 保底不足

从匹配池高分段补：

```js
safety 补充来源：matchPool 中 fitScore 较高、且 selectivityBand 为 friendly/mid 的项目
```

如果 friendly/mid 不足，再允许 high，但仍不把 elite 放入保底。

### 最终输出

最终结果尽量满足：

- reach: 2-3
- match: 8-10
- safety: 3-5

若项目库不足，允许低于下限；不强行凑满。

## 可选扩展（非 v1 范围）

- `profileHash` 增量检测，避免重复计算
- 选校页手动「重新匹配」按钮
- 各模块权重做成云数据库配置表，无需发版即可调参
- 后续接 AI 生成推荐理由
