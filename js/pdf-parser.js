/* ============================================================
 * pdf-parser.js —— PDF 成绩单文本解析（浏览器版）
 * 适配 pdf.js getTextContent().items 无空格拼接文本
 * 暴露全局：window.PDFTranscript = { pdfItemsToText, parseTranscriptText }
 * ============================================================ */
(function (global) {
  'use strict';

  var GRADE_WORDS = {
    '优': 95, '优秀': 95, '良': 85, '良好': 85, '中': 75, '中等': 75,
    '及格': 65, '通过': 65, '不及格': 0, '不合格': 0
  };
  var NATURES = ['必修', '专业选修', '专业核心', '专选', '限选', '公共选修', '任选', '通选', '跨选', '跨学科', '选修', '专业'];
  var NATURE_MAP = {
    '必修': '必修', '专选': '专业', '专业选修': '专业', '专业核心': '专业', '专业': '专业',
    '限选': '选修', '任选': '选修', '选修': '选修', '跨选': '选修', '通选': '选修', '公共选修': '选修', '跨学科': '选修'
  };

  function pdfItemsToText(items) {
    return items.map(function (i) { return i.str || ''; }).join('');
  }

  function parseScore(s) {
    s = String(s).replace(/[\*△＃#\s]/g, '');
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return GRADE_WORDS[s] !== undefined ? GRADE_WORDS[s] : null;
  }

  function parseTranscriptText(text) {
    var flat = text.replace(/\s+/g, ' ');
    var info = { school: '', name: '', studentId: '', major: '' };
    var m;

    if ((m = flat.match(/([\u4e00-\u9fa5]{2,12}(?:大学|学院|学校))本科?学业?成绩单/))) info.school = m[1];
    if ((m = flat.match(/姓名[:：]\s*([\u4e00-\u9fa5]{2,4}?)(?=课\s*程|出生|性别|$)/))) info.name = m[1];
    if ((m = flat.match(/学号[:：]\s*(\d{6,})/))) info.studentId = m[1];
    if ((m = flat.match(/专业[:：]\s*([\u4e00-\u9fa5]{2,12})(?=学科|学号|姓名|$)/))) info.major = m[1];

    var courses = [];
    var natAlt = NATURES.join('|');
    var scorePat = '(?:100|\\d{1,2})(?:\\.\\d+)?';
    var re = new RegExp('([^\\s]{1,30}|[\\u4e00-\\u9fa5A-Za-z0-9()ⅠⅡⅢ\\.\\-]+?)\\s+(' + natAlt + ')\\s+(\\d+(?:\\.\\d+)?)\\s+(优|优秀|良|良好|中|中等|及格|通过|不及格|' + scorePat + ')(?!\\d)', 'g');

    var stopPos = flat.search(/等级考试成绩|以下空白|算术平均成绩|毕业应获得/);
    var body = stopPos > 0 ? flat.slice(0, stopPos) : flat;

    var termRe = /(\d{4})\s*[-–—~至]?\s*(\d{0,4})\s*学年?\s*第?\s*([1-9一二三四])\s*学期/g;
    var segments = [], last = 0, segTerm = '未分学期', mm;
    while ((mm = termRe.exec(body)) !== null) {
      var before = body.slice(last, mm.index);
      if (before.trim()) segments.push({ term: segTerm, text: before });
      var n = mm[3].replace(/[一二三四]/, function (c) { return ({ '一': '1', '二': '2', '三': '3', '四': '4' })[c]; });
      segTerm = mm[1] + '-' + n;
      last = mm.index + mm[0].length;
    }
    if (last < body.length) segments.push({ term: segTerm, text: body.slice(last) });

    segments.forEach(function (seg) {
      var match; re.lastIndex = 0;
      while ((match = re.exec(seg.text)) !== null) {
        var name = match[1].replace(/\s+/g, ' ').trim().replace(/.*?学期/, '').replace(/^[\s\d]+/, '').trim();
        var credit = parseFloat(match[3]);
        var score = parseScore(match[4]);
        if (!name || score === null || !(credit > 0)) continue;
        courses.push({
          id: 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
          name: name, credit: credit, score: score,
          term: seg.term, type: NATURE_MAP[match[2]] || '选修'
        });
      }
    });
    return { courses: courses, info: info };
  }

  global.PDFTranscript = { pdfItemsToText: pdfItemsToText, parseTranscriptText: parseTranscriptText };
})(window);
