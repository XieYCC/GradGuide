// 工具函数模块

// 格式化数字差值
function fmtDelta(d) {
  if (d > 0) return { text: `+${d}`, color: 'var(--c-accent)' };
  if (d < 0) return { text: `${d}`, color: '#b4633a' };
  return { text: '±0', color: 'var(--c-ink-3)' };
}

// 计算模拟器综合评分
function calcScore(s) {
  let score = 0;
  score += Math.max(0, (s.gpa - 3.0)) / (1.0) * 20;
  score += Math.max(0, (s.toefl - 80)) / (38) * 15;
  score += s.gre > 0 ? Math.max(0, (s.gre - 300)) / (40) * 15 : 0;
  score += 35;

  const researchCount = typeof s.researchCount === 'number' ? s.researchCount : (s.research ? 1 : 0);
  const internCount = typeof s.internCount === 'number' ? s.internCount : (s.intern ? 1 : 0);
  const paperCount = typeof s.paperCount === 'number' ? s.paperCount : (s.paper ? 1 : 0);
  const awardCount = typeof s.awardCount === 'number' ? s.awardCount : (s.award ? 1 : 0);

  score += Math.min(12, paperCount * 7);
  score += Math.min(12, researchCount * 6);
  score += Math.min(8, internCount * 4);
  score += Math.min(6, awardCount * 3);
  return Math.min(100, Math.round(score));
}

// 计算档位人数（模拟器用）
function calcTier(score, baseScore, baseTier) {
  const delta = score - baseScore;
  return {
    reach: Math.max(0, baseTier.reach + Math.floor(delta / 2.5)),
    match: Math.max(0, baseTier.match + Math.floor(delta / 2)),
    safe: Math.max(0, baseTier.safe + Math.floor(delta / 3)),
  };
}

// 根据用户 profile 判断单个 program 属于哪一档
function classifyProgram(program, profile) {
  if (!profile || (!profile.gpa && !profile.toefl)) {
    // 无用户数据时，用数据库里的默认模板
    return program.tier || 'match';
  }
  const gpa = profile.gpa || 0;
  const toefl = profile.toefl || 0;
  const gre = profile.gre || 0;

  let gap = 0;
  // GPA 差距
  if (program.avgGpa) {
    gap += (program.avgGpa - gpa);
  }
  // TOEFL 差距
  if (program.toefl && toefl > 0) {
    gap += Math.max(0, (program.toefl - toefl)) / 20;
  }
  // GRE 差距（仅当 program 有 GRE 要求）
  if (program.gre && program.gre !== '不需要' && program.gre !== '可选' && gre > 0) {
    const greReq = parseInt(program.gre) || 320;
    gap += Math.max(0, (greReq - gre)) / 40;
  }

  if (gap <= 0) return 'safety';
  if (gap <= 0.3) return 'match';
  return 'reach';
}

module.exports = {
  fmtDelta,
  calcScore,
  calcTier,
  classifyProgram
};
