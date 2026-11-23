/* ============================================================
 * core.js  —— 数据持久化 + 绩点核心算法
 * 学业绩点智能分析系统
 * ============================================================ */

/** 生成唯一 ID */
function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** 安全 JSON 读取 */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('读取本地数据失败:', key, e);
    return fallback;
  }
}

/** 安全 JSON 写入 */
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('保存本地数据失败:', key, e);
    return false;
  }
}

/* ------------------------------------------------------------
 * 绩点换算规则
 * ------------------------------------------------------------ */
const GPA_RULES = {
  standard4: {
    name: '标准四分制（90/80/70/60）',
    max: 4.0,
    desc: '90分以上4.0，80分以上3.0，以此类推，是最常见的简化换算。',
    toPoint(score) {
      if (score >= 90) return 4.0;
      if (score >= 80) return 3.0;
      if (score >= 70) return 2.0;
      if (score >= 60) return 1.0;
      return 0;
    },
    // 由绩点反推达到该绩点所需的最低百分制分数
    toScore(point) {
      if (point <= 0) return 0;
      if (point <= 1.0) return 60;
      if (point <= 2.0) return 70;
      if (point <= 3.0) return 80;
      return 90;
    }
  },
  china4: {
    name: '中国大学细分四分制',
    max: 4.0,
    desc: '国内多数高校采用的细致分段（含3.7/3.3/2.7等档位）。',
    toPoint(score) {
      if (score >= 90) return 4.0;
      if (score >= 85) return 3.7;
      if (score >= 82) return 3.3;
      if (score >= 78) return 3.0;
      if (score >= 75) return 2.7;
      if (score >= 72) return 2.3;
      if (score >= 68) return 2.0;
      if (score >= 64) return 1.5;
      if (score >= 60) return 1.0;
      return 0;
    },
    toScore(point) {
      const table = [
        [1.0, 60], [1.5, 64], [2.0, 68], [2.3, 72], [2.7, 75],
        [3.0, 78], [3.3, 82], [3.7, 85], [4.0, 90]
      ];
      if (point <= 0) return 0;
      for (const [p, s] of table) {
        if (point <= p + 1e-9) return s;
      }
      return 90;
    }
  },
  linear5: {
    name: '线性五分制（满分5.0）',
    max: 5.0,
    desc: '绩点 = 分数/10 − 5（60分=1.0，100分=5.0），不及格为0。',
    toPoint(score) {
      if (score < 60) return 0;
      return Math.min(5.0, Math.max(0, score / 10 - 5));
    },
    toScore(point) {
      if (point <= 0) return 60;
      return Math.min(100, (point + 5) * 10);
    }
  },
  linear4: {
    name: '线性四分制（满分4.0）',
    max: 4.0,
    desc: '绩点 = 分数/25（100分=4.0），不及格为0。',
    toPoint(score) {
      if (score < 60) return 0;
      return Math.min(4.0, Math.max(0, score / 25));
    },
    toScore(point) {
      if (point <= 0) return 60;
      return Math.min(100, point * 25);
    }
  }
};

/* ------------------------------------------------------------
 * GPA 计算引擎
 * ------------------------------------------------------------ */
const GPA = {
  /** 单科绩点 */
  pointOf(score, ruleKey) {
    const rule = GPA_RULES[ruleKey] || GPA_RULES.standard4;
    return rule.toPoint(Number(score));
  },

  /** 是否为跨选课程（综测/保研口径中不计入加权绩点与平均成绩） */
  isCrossElective(c) {
    return !!(c && /^(跨选|跨学科)$/.test(String(c.type || '').trim()));
  },

  /** 按学期分组统计 */
  byTerm(courses, ruleKey) {
    const map = {};
    courses.forEach(c => {
      const term = c.term || '未分学期';
      if (!map[term]) map[term] = [];
      map[term].push(c);
    });
    return Object.keys(map).sort(compareTerm).map(term => ({
      term,
      courses: map[term],
      ...this.summary(map[term], ruleKey)
    }));
  },

  /** 一组课程的汇总：加权绩点、加权均分（均不含跨选）、总学分 */
  summary(courses, ruleKey) {
    let totalCredit = 0, passed = 0, failed = 0;
    // 综测/保研口径：跨选课程不计入绩点与均分，分子分母均使用独立累加器
    let avgCredit = 0, avgWeightedPoint = 0, avgWeightedScore = 0, avgCount = 0, crossCount = 0;
    courses.forEach(c => {
      const credit = Number(c.credit) || 0;
      const score = Number(c.score) || 0;
      totalCredit += credit;
      if (score >= 60) passed++; else failed++;
      if (this.isCrossElective(c)) {
        crossCount++;
      } else {
        avgCredit += credit;
        avgWeightedPoint += this.pointOf(score, ruleKey) * credit;
        avgWeightedScore += score * credit;
        avgCount++;
      }
    });
    return {
      count: courses.length,
      totalCredit: round(totalCredit, 2),
      // 加权绩点与加权均分口径一致：分子、分母都只统计非跨选课程
      gpa: avgCredit > 0 ? round(avgWeightedPoint / avgCredit, 3) : 0,
      avgScore: avgCredit > 0 ? round(avgWeightedScore / avgCredit, 2) : 0,
      avgCredit: round(avgCredit, 2),
      avgCount,
      crossCount,
      passed,
      failed
    };
  },

  /**
   * 绩点逆向测算
   * @param {object} opt
   * @param {number} opt.targetGPA    目标绩点
   * @param {number} opt.doneCredits  已修（已录入）学分
   * @param {number} opt.donePoints   已获绩点积点 = Σ(绩点×学分)
   * @param {number} opt.remainCredits 剩余待修学分
   * @param {string} opt.ruleKey      换算规则
   */
  reverse(opt) {
    const rule = GPA_RULES[opt.ruleKey] || GPA_RULES.standard4;
    const target = Number(opt.targetGPA);
    const doneCredits = Number(opt.doneCredits) || 0;
    const donePoints = Number(opt.donePoints) || 0;
    const remain = Number(opt.remainCredits) || 0;

    if (!isFinite(target) || target < 0 || target > rule.max) {
      return { ok: false, msg: `目标绩点需在 0 ~ ${rule.max} 之间` };
    }
    if (remain <= 0) {
      return { ok: false, msg: '剩余学分需大于 0' };
    }

    const totalCredits = doneCredits + remain;
    const needPoints = target * totalCredits - donePoints;
    const needGPA = needPoints / remain;

    let status, advice;
    if (needGPA <= 0) {
      status = 'reached';
      advice = '以当前进度，即使剩余课程绩点为 0，也能达到目标绩点。';
    } else if (needGPA > rule.max) {
      status = 'impossible';
      advice = `需要后续每门课平均绩点达到 ${round(needGPA, 2)}，超出该规则上限 ${rule.max}，目标当前不可达。`;
    } else {
      status = 'possible';
      advice = `后续 ${remain} 学分需保持平均绩点约 ${round(needGPA, 2)}（约 ${Math.round(rule.toScore(needGPA))} 分/门）。`;
    }

    return {
      ok: true,
      status,
      needGPA: round(needGPA, 3),
      needScore: Math.round(rule.toScore(needGPA)),
      target,
      totalCredits: round(totalCredits, 2),
      remain,
      advice
    };
  },

  /** 已修学分与绩点积点（基于当前录入的课程，不含跨选，与绩点口径一致） */
  earned(courses, ruleKey) {
    let credits = 0, points = 0, crossCount = 0;
    courses.forEach(c => {
      if (this.isCrossElective(c)) { crossCount++; return; }
      const credit = Number(c.credit) || 0;
      credits += credit;
      points += this.pointOf(c.score, ruleKey) * credit;
    });
    return { credits: round(credits, 2), points: round(points, 3), crossCount };
  }
};

/** 学期排序：如「2024-1」「2024-2」「大一下」尽量按自然顺序 */
function compareTerm(a, b) {
  const na = extractNum(a), nb = extractNum(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a).localeCompare(String(b), 'zh-CN');
}
function extractNum(s) {
  const m = String(s).match(/(\d{4})[\-–—学年]?\s*([12]?)/);
  if (!m) return null;
  return Number(m[1]) * 10 + (Number(m[2]) || 0);
}
function round(n, d) {
  const p = Math.pow(10, d);
  return Math.round((Number(n) + Number.EPSILON) * p) / p;
}

/* ------------------------------------------------------------
 * Store —— 数据持久化（localStorage + IndexedDB 图片）
 * ------------------------------------------------------------ */
const Store = {
  K_COURSE: 'gpa_system_courses',
  K_AWARD: 'gpa_system_awards',
  K_SETTINGS: 'gpa_system_settings',
  _db: null,

  /* ---- 设置 ---- */
  getSettings() {
    return Object.assign(
      { rule: 'standard4', targetGPA: 3.5, remainCredits: 0, school: '' },
      readJSON(this.K_SETTINGS, {})
    );
  },
  saveSettings(s) { writeJSON(this.K_SETTINGS, s); },

  /* ---- 课程 ---- */
  getCourses() { return readJSON(this.K_COURSE, []); },
  saveCourses(list) { return writeJSON(this.K_COURSE, list); },
  addCourse(course) {
    const list = this.getCourses();
    course.id = course.id || uid('c');
    list.push(course);
    this.saveCourses(list);
    return course;
  },
  updateCourse(id, patch) {
    const list = this.getCourses();
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) { list[idx] = Object.assign({}, list[idx], patch); this.saveCourses(list); }
    return list[idx];
  },
  deleteCourse(id) {
    this.saveCourses(this.getCourses().filter(c => c.id !== id));
  },

  /* ---- 奖状元数据（图片存 IndexedDB） ---- */
  getAwards() { return readJSON(this.K_AWARD, []); },
  saveAwards(list) { return writeJSON(this.K_AWARD, list); },
  addAward(a) {
    const list = this.getAwards();
    a.id = a.id || uid('a');
    list.push(a);
    this.saveAwards(list);
    return a;
  },
  deleteAward(id) {
    const a = this.getAwards().find(x => x.id === id);
    if (a && a.imgKey) this.deleteImage(a.imgKey);
    this.saveAwards(this.getAwards().filter(x => x.id !== id));
  },

  /* ---- IndexedDB 图片存储 ---- */
  openDB() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('gpa_award_db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },
  putImage(key, dataURL) {
    return this.openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(dataURL, key);
      tx.oncomplete = () => resolve(key);
      tx.onerror = () => reject(tx.error);
    }));
  },
  getImage(key) {
    return this.openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const req = tx.objectStore('images').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  },
  deleteImage(key) {
    return this.openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  },

  /* ---- 备份 / 恢复 ---- */
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      courses: this.getCourses(),
      awards: this.getAwards()
    };
  },
  importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('文件格式不正确');
    if (Array.isArray(data.courses)) this.saveCourses(data.courses);
    if (Array.isArray(data.awards)) this.saveAwards(data.awards);
    if (data.settings) this.saveSettings(Object.assign(this.getSettings(), data.settings));
  },

  /* ---- 示例数据 ---- */
  loadDemo() {
    const demoCourses = [
      { name: '高等数学1', credit: 6, score: 78, term: '2025-1', type: '必修' },
      { name: '大学外语1', credit: 3, score: 80, term: '2025-1', type: '必修' },
      { name: 'C语言程序设计1', credit: 3, score: 65, term: '2025-1', type: '必修' },
      { name: '线性代数', credit: 3, score: 90, term: '2025-1', type: '必修' },
      { name: '高等数学2', credit: 6, score: 82, term: '2025-2', type: '必修' },
      { name: '大学外语2', credit: 3, score: 78, term: '2025-2', type: '必修' },
      { name: '数据结构', credit: 4, score: 70, term: '2025-2', type: '必修' },
      { name: '计算机组成原理', credit: 3, score: 86, term: '2025-2', type: '必修' },
      { name: '中国近代史纲要', credit: 3, score: 91, term: '2025-1', type: '必修' },
      { name: '离散数学', credit: 4.5, score: 89, term: '2025-2', type: '必修' },
      { name: '军训', credit: 2, score: 80, term: '2025-1', type: '必修' },
      { name: '湘谈四史', credit: 2, score: 99, term: '2025-2', type: '选修' }
    ];
    demoCourses.forEach(c => { c.id = uid('c'); });
    this.saveCourses(demoCourses);
    this.saveAwards([]);
    const s = this.getSettings();
    s.targetGPA = 3.5; s.remainCredits = 30;
    this.saveSettings(s);
  }
};
