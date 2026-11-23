/* ============================================================
 * app.js —— 主应用：页面渲染与交互
 * 学业绩点智能分析系统
 * ============================================================ */

/* ---------- 全局状态 ---------- */
const App = {
  page: 'dashboard',
  charts: {},          // 已创建的图表实例
  awardFilter: '全部',
  awardSearch: '',
  editCourseId: null
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const content = $('#content');
const PAGE_META = {
  dashboard: ['学业总览', '你的学业数据一目了然'],
  courses:   ['成绩录入', '手动录入或表格导入课程成绩'],
  gpa:       ['绩点计算', '自动统计学期与累计加权绩点'],
  reverse:   ['保研测算', '反推后续学期需要达到的成绩'],
  charts:    ['可视化报告', '图表呈现成绩分布与绩点趋势'],
  awards:    ['荣誉档案', '分类归档你的获奖证书与奖状'],
  settings:  ['设置与备份', '换算规则、数据导入导出']
};

/* ---------- 工具 ---------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.style.display='block';
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.style.display='none',2200);
}
function ruleKey(){ return Store.getSettings().rule; }
function badgeClass(type){ return type==='必修'?'必':type==='跨选'?'跨':type==='选修'?'选':'other'; }

/* ---------- 弹窗 ---------- */
function openModal(title, bodyHTML, footHTML){
  $('#modalTitle').textContent=title;
  $('#modalBody').innerHTML=bodyHTML;
  $('#modalFoot').innerHTML=footHTML||'';
  $('#modalBackdrop').style.display='flex';
}
function closeModal(){ $('#modalBackdrop').style.display='none'; }

/* ---------- 导航切换 ---------- */
function navigate(page){
  App.page=page;
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const meta=PAGE_META[page]||['',''];
  $('#pageTitle').textContent=meta[0];
  $('#pageSubtitle').textContent=meta[1];
  // 销毁旧图表避免重叠
  Object.values(App.charts).forEach(c=>{ try{c.destroy();}catch(e){} });
  App.charts={};
  render();
}
function render(){
  const map={
    dashboard:renderDashboard, courses:renderCourses, gpa:renderGpa,
    reverse:renderReverse, charts:renderCharts, awards:renderAwards, settings:renderSettings
  };
  (map[App.page]||renderDashboard)();
}

/* ============================================================
 * 页面 1：学业总览
 * ============================================================ */
function renderDashboard(){
  const courses=Store.getCourses();
  const rk=ruleKey();
  const sum=GPA.summary(courses,rk);
  const terms=GPA.byTerm(courses,rk);
  const awards=Store.getAwards();
  const latestTerm=terms.length?terms[terms.length-1]:null;

  content.innerHTML=`<div class="page">
    <div class="kpi-grid">
      <div class="kpi c1">
        <div class="kpi-label">累计加权绩点 <span style="font-size:11px;color:var(--ink-3);font-weight:400;">(不含跨选)</span></div>
        <div class="kpi-value">${sum.gpa.toFixed(2)}<small>/ ${GPA_RULES[rk].max.toFixed(1)}</small></div>
        <div class="kpi-foot">按 ${sum.avgCredit} 学分计算${sum.crossCount?` · 已排除 ${sum.crossCount} 门跨选`:''}</div>
      </div>
      <div class="kpi c2">
        <div class="kpi-label">加权平均分 <span style="font-size:11px;color:var(--ink-3);font-weight:400;">(不含跨选)</span></div>
        <div class="kpi-value">${sum.avgScore.toFixed(1)}<small>分</small></div>
        <div class="kpi-foot">按学分加权 · 跨选课程不计入</div>
      </div>
      <div class="kpi c3">
        <div class="kpi-label">已修总学分</div>
        <div class="kpi-value">${sum.totalCredit}<small>学分</small></div>
        <div class="kpi-foot">${latestTerm?'最新：'+esc(latestTerm.term):'暂无数据'}</div>
      </div>
      <div class="kpi c4">
        <div class="kpi-label">荣誉证书</div>
        <div class="kpi-value">${awards.length}<small>项</small></div>
        <div class="kpi-foot">个人荣誉档案</div>
      </div>
    </div>

    <div class="section-title">快捷操作</div>
    <div class="grid-2">
      <div class="card" style="cursor:pointer;" onclick="navigate('courses')">
        <div class="card-title">✎ 录入成绩</div>
        <div class="card-sub">手动添加或批量导入课程成绩</div>
      </div>
      <div class="card" style="cursor:pointer;" onclick="navigate('reverse')">
        <div class="card-title">◎ 保研测算</div>
        <div class="card-sub">输入目标绩点，反推所需成绩</div>
      </div>
    </div>

    <div class="section-title">最近学期成绩</div>
    <div class="card">${recentTableHTML(courses,rk)}</div>
  </div>`;
}
function recentTableHTML(courses,rk){
  if(!courses.length) return emptyHTML('还没有课程数据，点击右上角「添加课程」开始');
  const recent=[...courses].reverse().slice(0,6);
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>课程名称</th><th>学分</th><th>分数</th><th>绩点</th><th>学期</th><th>性质</th></tr></thead>
    <tbody>${recent.map(c=>{
      const p=GPA.pointOf(c.score,rk);
      return `<tr><td>${esc(c.name)}</td><td>${c.credit}</td><td>${c.score}</td>
        <td class="${p>=3.7?'point-hi':p<1?'point-lo':''}">${p.toFixed(2)}</td>
        <td>${esc(c.term||'-')}</td><td><span class="badge ${badgeClass(c.type)}">${esc(c.type||'其他')}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function emptyHTML(msg){ return `<div class="empty"><span class="empty-ico">◌</span><p>${msg}</p></div>`; }

/* ============================================================
 * 页面 2：成绩录入
 * ============================================================ */
function renderCourses(){
  const courses=Store.getCourses();
  const rk=ruleKey();
  content.innerHTML=`<div class="page">
    <div class="card" style="margin-bottom:18px;">
      <div class="row wrap">
        <button class="btn btn-primary" onclick="openCourseModal()">+ 手动添加</button>
        <button class="btn btn-ghost" onclick="triggerImport()">⇪ 表格导入 (Excel/CSV)</button>
        <button class="btn btn-ghost" style="border-color:var(--accent);color:var(--accent);" onclick="triggerPdfImport()">⇪ PDF成绩单导入</button>
        <button class="btn btn-ghost" onclick="downloadTemplate()">↓ 下载导入模板</button>
        <div class="spacer"></div>
        <span style="font-size:12px;color:var(--ink-3);">共 ${courses.length} 门课程</span>
        ${courses.length?`<button class="btn btn-danger btn-sm" onclick="clearCourses()">清空</button>`:''}
      </div>
    </div>
    <div class="card">${coursesTableHTML(courses,rk)}</div>
  </div>`;
}
function coursesTableHTML(courses,rk){
  if(!courses.length) return emptyHTML('暂无成绩记录，点击「手动添加」或「表格导入」');
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>课程名称</th><th>学分</th><th>分数</th><th>绩点</th><th>学期</th><th>性质</th><th style="text-align:right;">操作</th></tr></thead>
    <tbody>${courses.map(c=>{
      const p=GPA.pointOf(c.score,rk);
      return `<tr><td><b>${esc(c.name)}</b></td><td>${c.credit}</td><td>${c.score}</td>
        <td class="${p>=3.7?'point-hi':p<1?'point-lo':''}">${p.toFixed(2)}</td>
        <td>${esc(c.term||'-')}</td><td><span class="badge ${badgeClass(c.type)}">${esc(c.type||'其他')}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm" onclick="openCourseModal('${c.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="delCourse('${c.id}')">删除</button>
        </td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function openCourseModal(id){
  App.editCourseId=id||null;
  const c=id?Store.getCourses().find(x=>x.id===id):null;
  const terms=[...new Set(Store.getCourses().map(x=>x.term).filter(Boolean))];
  const body=`<div class="form-grid">
    <div class="field full"><label>课程名称 *</label><input id="f_name" value="${c?esc(c.name):''}" placeholder="如：高等数学(上)"></div>
    <div class="field"><label>学分 *</label><input id="f_credit" type="number" step="0.5" min="0" value="${c?c.credit:''}" placeholder="如：3"></div>
    <div class="field"><label>分数 *</label><input id="f_score" type="number" step="0.1" min="0" max="100" value="${c?c.score:''}" placeholder="0-100"></div>
    <div class="field"><label>学期</label><input id="f_term" list="termList" value="${c?esc(c.term||''):''}" placeholder="如：2024-1"><datalist id="termList">${terms.map(t=>`<option value="${esc(t)}">`).join('')}</datalist></div>
    <div class="field"><label>课程性质</label><select id="f_type">
      ${['必修','选修','跨选','其他'].map(t=>`<option ${c&&c.type===t?'selected':''}>${t}</option>`).join('')}
    </select></div>
  </div>`;
  const foot=`<button class="btn btn-ghost" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveCourse()">保存</button>`;
  openModal(c?'编辑课程':'添加课程',body,foot);
  setTimeout(()=>$('#f_name').focus(),50);
}
function saveCourse(){
  const name=$('#f_name').value.trim();
  const credit=parseFloat($('#f_credit').value);
  const score=parseFloat($('#f_score').value);
  if(!name){ toast('请填写课程名称'); return; }
  if(!(credit>0)){ toast('请填写有效学分'); return; }
  if(!(score>=0&&score<=100)){ toast('分数需在 0-100 之间'); return; }
  const data={name,credit,score,term:$('#f_term').value.trim()||'未分学期',type:$('#f_type').value};
  if(App.editCourseId){ Store.updateCourse(App.editCourseId,data); toast('已更新课程'); }
  else{ Store.addCourse(data); toast('已添加课程'); }
  closeModal(); render();
}
function delCourse(id){
  if(!confirm('确定删除这门课程？')) return;
  Store.deleteCourse(id); toast('已删除'); render();
}
function clearCourses(){
  if(!confirm('确定清空所有课程数据？此操作不可撤销。')) return;
  Store.saveCourses([]); toast('已清空'); render();
}

/* ---- 表格导入 ---- */
function triggerImport(){
  const inp=$('#fileInput');
  inp.value=''; inp.accept='.xlsx,.xls,.csv';
  inp.onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1});
        parseImportRows(rows);
      }catch(err){ toast('文件解析失败：'+err.message); }
    };
    reader.readAsArrayBuffer(file);
  };
  inp.click();
}
function parseImportRows(rows){
  // 期望列：课程名称 / 学分 / 分数 / 学期 / 性质
  let start=0;
  if(rows.length && /课程|名称|name/i.test(String(rows[0][0]||''))) start=1;
  const added=[];
  for(let i=start;i<rows.length;i++){
    const r=rows[i];
    if(!r||r.length<3) continue;
    const name=String(r[0]||'').trim();
    const credit=parseFloat(r[1]);
    const score=parseFloat(r[2]);
    if(!name||!(credit>0)||!(score>=0&&score<=100)) continue;
    added.push({id:uid('c'),name,credit,score,term:String(r[3]||'未分学期').trim(),type:String(r[4]||'必修').trim()});
  }
  if(!added.length){ toast('未识别到有效数据，请检查表格格式'); return; }
  const list=Store.getCourses().concat(added);
  Store.saveCourses(list);
  toast(`成功导入 ${added.length} 门课程`);
  navigate('courses');
}
/* ---- PDF 成绩单导入 ---- */
function triggerPdfImport(){
  if(typeof pdfjsLib==='undefined'){ toast('PDF 组件未加载'); return; }
  const inp=$('#fileInput');
  inp.value=''; inp.accept='.pdf';
  inp.onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    toast('正在解析 PDF…');
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const data=new Uint8Array(ev.target.result);
      pdfjsLib.getDocument({data}).promise.then(async pdf=>{
        let fullText='';
        for(let p=1;p<=pdf.numPages;p++){
          const page=await pdf.getPage(p);
          const tc=await page.getTextContent();
          fullText+=PDFTranscript.pdfItemsToText(tc.items)+'\n';
        }
        const result=PDFTranscript.parseTranscriptText(fullText);
        if(!result.courses.length){
          openModal('未能识别课程',`<div class="empty"><span class="empty-ico">◌</span>
            <p>没有从 PDF 中识别到课程。请确认这是标准的学业成绩单（含"课程名称/性质/学分/成绩"表格）。</p>
            <p style="font-size:12px;color:var(--ink-3);margin-top:8px;">如格式特殊，可改用「表格导入」或手动录入。</p></div>`,
            `<button class="btn btn-ghost" onclick="closeModal()">知道了</button>`);
          return;
        }
        showPdfPreview(result);
      }).catch(err=>{ toast('PDF 解析失败：'+err.message); });
    };
    reader.readAsArrayBuffer(file);
  };
  inp.click();
}
function showPdfPreview(result){
  App.pdfDraft=result.courses.map(c=>Object.assign({},c,{checked:true}));
  const info=result.info;
  const infoLine=[info.school,info.major,info.name].filter(Boolean).join(' · ');
  const body=`
    ${infoLine?`<div style="background:var(--primary-light);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--primary);">识别到：${esc(infoLine)}</div>`:''}
    <p style="font-size:12px;color:var(--ink-2);margin-bottom:12px;">共识别 <b style="color:var(--primary);">${result.courses.length}</b> 门课程，请核对后勾选需要导入的条目（"优/良"等等级已按 95/85 分换算）。</p>
    <div style="max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:10px;">
      <table class="data" style="font-size:12px;">
        <thead><tr><th style="width:36px;">✓</th><th>课程名称</th><th>学分</th><th>分数</th><th>学期</th><th>性质</th></tr></thead>
        <tbody>${App.pdfDraft.map((c,i)=>`<tr>
          <td><input type="checkbox" data-pdf-i="${i}" ${c.checked?'checked':''} style="width:15px;height:15px;accent-color:var(--primary);"></td>
          <td>${esc(c.name)}</td><td>${c.credit}</td><td>${c.score}</td>
          <td>${esc(c.term)}</td><td><span class="badge ${badgeClass(c.type)}">${esc(c.type)}</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;" class="row">
      <label style="font-size:12px;color:var(--ink-2);display:flex;align-items:center;gap:6px;">
        <input type="radio" name="pdfMode" value="append" checked style="accent-color:var(--primary);"> 追加到现有数据
      </label>
      <label style="font-size:12px;color:var(--ink-2);display:flex;align-items:center;gap:6px;">
        <input type="radio" name="pdfMode" value="replace" style="accent-color:var(--primary);"> 覆盖现有全部课程
      </label>
    </div>`;
  const foot=`<button class="btn btn-ghost" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="confirmPdfImport()">确认导入</button>`;
  openModal('PDF 成绩单导入预览',body,foot);
  $$('input[data-pdf-i]').forEach(ch=>{
    ch.onchange=()=>{ App.pdfDraft[Number(ch.dataset.pdfI)].checked=ch.checked; };
  });
}
function confirmPdfImport(){
  const picked=App.pdfDraft.filter(c=>c.checked);
  if(!picked.length){ toast('请至少勾选一门课程'); return; }
  const mode=($('input[name="pdfMode"]:checked')||{}).value||'append';
  picked.forEach(c=>{ delete c.checked; });
  if(mode==='replace') Store.saveCourses(picked);
  else Store.saveCourses(Store.getCourses().concat(picked));
  closeModal();
  toast(`成功导入 ${picked.length} 门课程`);
  navigate('courses');
}
function downloadTemplate(){
  const data=[
    ['课程名称','学分','分数','学期','性质'],
    ['高等数学',5,88,'2024-1','必修'],
    ['大学英语',3,92,'2024-1','必修'],
    ['数据结构',4,95,'2024-2','必修']
  ];
  const ws=XLSX.utils.aoa_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'成绩导入模板');
  XLSX.writeFile(wb,'成绩导入模板.xlsx');
  toast('模板已下载');
}

/* ============================================================
 * 页面 3：绩点计算
 * ============================================================ */
function renderGpa(){
  const courses=Store.getCourses();
  const rk=ruleKey();
  const terms=GPA.byTerm(courses,rk);
  const all=GPA.summary(courses,rk);
  content.innerHTML=`<div class="page">
    <div class="card" style="margin-bottom:18px;">
      <div class="row wrap">
        <div><span style="font-size:12px;color:var(--ink-3);">换算规则：</span>
          <select id="ruleSelect" style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;" onchange="changeRule(this.value)">
            ${Object.keys(GPA_RULES).map(k=>`<option value="${k}" ${k===rk?'selected':''}>${GPA_RULES[k].name}</option>`).join('')}
          </select>
        </div>
        <div class="spacer"></div>
        <span style="font-size:12px;color:var(--ink-3);">${GPA_RULES[rk].desc}</span>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:18px;">
      <div class="kpi c1"><div class="kpi-label">累计加权绩点 <span style="font-size:11px;color:var(--ink-3);font-weight:400;">(不含跨选)</span></div><div class="kpi-value">${all.gpa.toFixed(3)}</div><div class="kpi-foot">按 ${all.avgCredit} 学分计 · 满分 ${GPA_RULES[rk].max.toFixed(1)}${all.crossCount?` · 排除 ${all.crossCount} 门跨选`:''}</div></div>
      <div class="kpi c2"><div class="kpi-label">加权平均分 <span style="font-size:11px;color:var(--ink-3);font-weight:400;">(不含跨选)</span></div><div class="kpi-value">${all.avgScore.toFixed(2)}</div><div class="kpi-foot">统计 ${all.avgCount} 门${all.crossCount?` · 已排除 ${all.crossCount} 门跨选`:''}</div></div>
      <div class="kpi c3"><div class="kpi-label">总学分</div><div class="kpi-value">${all.totalCredit}</div><div class="kpi-foot">已修满学分</div></div>
      <div class="kpi c4"><div class="kpi-label">及格 / 挂科</div><div class="kpi-value">${all.passed}<small>/ ${all.failed}</small></div><div class="kpi-foot">门数统计</div></div>
    </div>

    <div class="card">
      <div class="card-title">各学期绩点明细</div>
      <div class="card-sub">按学期分组统计加权绩点与学分</div>
      ${terms.length?termsTableHTML(terms):emptyHTML('暂无数据')}
    </div>
  </div>`;
}
function termsTableHTML(terms){
  let html=`<div class="table-wrap"><table class="data">
    <thead><tr><th>学期</th><th>课程数</th><th>学分</th><th>加权均分(不含跨选)</th><th>学期绩点(不含跨选)</th><th>挂科</th></tr></thead><tbody>`;
  terms.forEach(t=>{
    html+=`<tr><td><b>${esc(t.term)}</b></td><td>${t.count}</td><td>${t.totalCredit}</td>
      <td>${t.avgScore.toFixed(2)}</td>
      <td class="${t.gpa>=3.7?'point-hi':t.gpa<2?'point-lo':''}"><b>${t.gpa.toFixed(3)}</b></td>
      <td>${t.failed||'-'}</td></tr>`;
  });
  html+=`</tbody></table></div>`;
  return html;
}
function changeRule(v){ const s=Store.getSettings(); s.rule=v; Store.saveSettings(s); render(); toast('换算规则已更新'); }

/* ============================================================
 * 页面 4：保研逆向测算
 * ============================================================ */
function renderReverse(){
  const s=Store.getSettings();
  const courses=Store.getCourses();
  const rk=s.rule;
  const earned=GPA.earned(courses,rk);
  const max=GPA_RULES[rk].max;
  content.innerHTML=`<div class="page">
    <div class="grid-2-3">
      <div class="card">
        <div class="card-title">◎ 目标绩点测算</div>
        <div class="card-sub">输入目标与剩余学分，反推后续需要达到的成绩</div>
        <div class="stat-line"><span class="k">当前换算规则</span><span class="v">${GPA_RULES[rk].name}（满分${max}）</span></div>
        <div class="stat-line"><span class="k">已修学分 <span style="font-size:11px;color:var(--ink-3);">(不含跨选)</span></span><span class="v">${earned.credits}</span></div>
        <div class="stat-line"><span class="k">已获绩点积点 Σ(绩点×学分)</span><span class="v">${earned.points}</span></div>
        <div class="stat-line"><span class="k">当前累计绩点</span><span class="v">${earned.credits?round(earned.points/earned.credits,3):0}</span></div>
        ${earned.crossCount?`<div class="stat-line"><span class="k">已排除跨选课程</span><span class="v">${earned.crossCount} 门（不计入绩点）</span></div>`:''}

        <div class="form-grid" style="margin-top:20px;">
          <div class="field"><label>目标保研绩点</label><input id="r_target" type="number" step="0.01" min="0" max="${max}" value="${s.targetGPA}"></div>
          <div class="field"><label>剩余待修学分</label><input id="r_remain" type="number" step="0.5" min="0" value="${s.remainCredits}"></div>
        </div>
        <button class="btn btn-primary" style="margin-top:16px;width:100%;" onclick="doReverse()">开始测算</button>
      </div>

      <div class="card">
        <div class="card-title">测算说明</div>
        <p style="font-size:13px;color:var(--ink-2);line-height:1.9;">
          保研绩点测算基于加权平均绩点公式：<br>
          <code style="background:var(--bg);padding:2px 6px;border-radius:5px;">目标绩点 = 总绩点积点 ÷ 总学分</code>
        </p>
        <p style="font-size:13px;color:var(--ink-2);line-height:1.9;margin-top:12px;">
          系统会结合你已录入的成绩（已修学分与已获绩点积点，<b>跨选课程不计入</b>），反推出：<b>剩余学分需要达到的平均绩点</b>，并换算成大致的<b>百分制分数</b>，为你的学业规划提供量化参考。
        </p>
        <div class="tip-card" style="margin-top:16px;">
          <div class="tip-title">提示</div>
          <p>剩余学分请填写尚未取得成绩的课程总学分，如大三、大四待修课程。</p>
        </div>
      </div>
    </div>
    <div id="reverseResult"></div>
  </div>`;
}
function doReverse(){
  const s=Store.getSettings();
  const target=parseFloat($('#r_target').value);
  const remain=parseFloat($('#r_remain').value);
  s.targetGPA=target; s.remainCredits=remain; Store.saveSettings(s);
  const courses=Store.getCourses();
  const earned=GPA.earned(courses,s.rule);
  const res=GPA.reverse({
    targetGPA:target, doneCredits:earned.credits, donePoints:earned.points,
    remainCredits:remain, ruleKey:s.rule
  });
  const box=$('#reverseResult');
  if(!res.ok){ box.innerHTML=`<div class="result-box impossible"><div class="result-advice">${res.msg}</div></div>`; return; }
  let big,label;
  if(res.status==='reached'){ big='已达标'; label='当前进度已满足目标'; }
  else if(res.status==='impossible'){ big=res.needGPA.toFixed(2); label='所需平均绩点（超出上限）'; }
  else{ big=res.needGPA.toFixed(2); label='后续课程需保持的平均绩点'; }
  box.innerHTML=`<div class="result-box ${res.status}">
    <div class="result-big">${big}${res.status!=='reached'?'<small> GPA</small>':''}</div>
    <div class="result-label">${label}</div>
    ${res.status!=='reached'?`<div class="result-label" style="margin-top:6px;font-size:14px;">≈ 每门课需达到 <b style="color:var(--primary);font-size:18px;">${res.needScore}</b> 分</div>`:''}
    <div class="result-advice">${res.advice}</div>
  </div>`;
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ============================================================
 * 页面 5：可视化报告
 * ============================================================ */
function renderCharts(){
  const courses=Store.getCourses();
  const rk=ruleKey();
  const terms=GPA.byTerm(courses,rk);
  content.innerHTML=`<div class="page">
    ${courses.length?'':emptyHTML('暂无成绩数据，请先录入课程')}
    <div class="grid-2">
      <div class="card">
        <div class="card-title">学期绩点变化趋势</div>
        <div class="card-sub">观察绩点随学期的变化</div>
        <div class="chart-box"><canvas id="chartTerm"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">成绩分布</div>
        <div class="card-sub">各分数段课程数量</div>
        <div class="chart-box"><canvas id="chartDist"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">绩点档位学分统计</div>
        <div class="card-sub">按 3.7 / 3.0 绩点分档统计学分</div>
        <div class="chart-box"><canvas id="chartGpaCredit"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">各学期学分分布</div>
        <div class="card-sub">每学期修读学分对比</div>
        <div class="chart-box"><canvas id="chartCredit"></canvas></div>
      </div>
    </div>
  </div>`;
  if(!courses.length) return;
  buildCharts(courses,terms,rk);
}
function buildCharts(courses,terms,rk){
  Chart.defaults.font.family='"PingFang SC","Microsoft YaHei",sans-serif';
  Chart.defaults.color='#5b6478';
  Chart.defaults.animation=false;   // 即时呈现，避免淡入中间态
  // 学期绩点趋势
  App.charts.term=new Chart($('#chartTerm'),{
    type:'line',
    data:{labels:terms.map(t=>t.term),datasets:[{
      label:'学期绩点',data:terms.map(t=>t.gpa),
      borderColor:'#5b6ef5',backgroundColor:'rgba(91,110,245,.12)',
      fill:true,tension:.3,pointBackgroundColor:'#5b6ef5',pointRadius:5,borderWidth:2.5
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{beginAtZero:true,suggestedMax:GPA_RULES[rk].max}}}
  });
  // 成绩分布
  const bins=[0,0,0,0,0,0];
  const labels=['<60','60-69','70-79','80-89','90-100','满分'];
  courses.forEach(c=>{
    const s=c.score;
    if(s<60)bins[0]++; else if(s<70)bins[1]++; else if(s<80)bins[2]++;
    else if(s<90)bins[3]++; else if(s<100)bins[4]++; else bins[5]++;
  });
  App.charts.dist=new Chart($('#chartDist'),{
    type:'bar',
    data:{labels,datasets:[{label:'课程数',data:bins,
      backgroundColor:['#e5484d','#f59e0b','#eab308','#60a5fa','#16a875','#5b6ef5'],borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
  });
  // 绩点档位学分统计：≥3.7 / 3.0~3.69 / <3.0
  let hi=0, mid=0, lo=0;
  courses.forEach(c=>{
    const cr=Number(c.credit)||0;
    const p=GPA.pointOf(Number(c.score),rk);
    if(p>=3.7) hi+=cr; else if(p>=3.0) mid+=cr; else lo+=cr;
  });
  hi=Math.round(hi*10)/10; mid=Math.round(mid*10)/10; lo=Math.round(lo*10)/10;
  App.charts.gpaCredit=new Chart($('#chartGpaCredit'),{
    type:'doughnut',
    data:{labels:['绩点 ≥ 3.7','绩点 3.0 ~ 3.7','绩点 < 3.0'],datasets:[{
      data:[hi,mid,lo],
      backgroundColor:['#16a875','#5b6ef5','#f59e0b'],borderWidth:0
    }]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{position:'right',labels:{boxWidth:14,padding:14}},
        tooltip:{callbacks:{label:function(ctx){return ' '+ctx.label+'：'+ctx.parsed+' 学分';}}}}}
  });
  // 各学期学分
  App.charts.credit=new Chart($('#chartCredit'),{
    type:'bar',
    data:{labels:terms.map(t=>t.term),datasets:[{label:'学分',data:terms.map(t=>t.totalCredit),
      backgroundColor:'rgba(139,92,246,.75)',borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{beginAtZero:true}}}
  });
}

/* ============================================================
 * 页面 6：荣誉档案
 * ============================================================ */
function getFilteredAwards(){
  let filtered=Store.getAwards().filter(a=>App.awardFilter==='全部'||a.category===App.awardFilter);
  if(App.awardSearch){
    const q=App.awardSearch.toLowerCase();
    filtered=filtered.filter(a=>(a.title||'').toLowerCase().includes(q)||(a.category||'').toLowerCase().includes(q));
  }
  return filtered.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function renderAwards(){
  const awards=Store.getAwards();
  const cats=['全部',...new Set(awards.map(a=>a.category).filter(Boolean))];
  if(!cats.includes(App.awardFilter)) App.awardFilter='全部';
  content.innerHTML=`<div class="page">
    <div class="card" style="margin-bottom:18px;">
      <div class="row wrap">
        <button class="btn btn-primary" onclick="openAwardModal()">+ 上传奖状</button>
        <input id="awardSearch" class="search-input" placeholder="🔍 搜索奖项名称/类别" value="${esc(App.awardSearch)}"
          style="flex:1;min-width:200px;padding:9px 12px;border:1px solid var(--line);border-radius:9px;font-size:13px;" />
        <span style="font-size:12px;color:var(--ink-3);">共 ${awards.length} 项荣誉</span>
      </div>
      <div class="cat-tags" style="margin-top:14px;margin-bottom:0;">
        ${cats.map(c=>`<button class="cat-tag ${App.awardFilter===c?'active':''}" onclick="filterAward('${esc(c)}')">${esc(c)}</button>`).join('')}
      </div>
    </div>
    <div class="award-grid" id="awardGrid"></div>
  </div>`;
  $('#awardSearch').oninput=(e)=>{ App.awardSearch=e.target.value; renderAwardList(); };
  renderAwardList();
}
function renderAwardList(){
  const filtered=getFilteredAwards();
  const grid=$('#awardGrid');
  if(!grid) return;
  if(!filtered.length){
    const total=Store.getAwards().length;
    grid.innerHTML=`<div class="empty" style="grid-column:1/-1;"><span class="empty-ico">★</span><p>${total?'没有匹配的奖状，试试其他关键词':'暂无奖状，点击「上传奖状」建立你的荣誉档案'}</p></div>`;
  } else {
    grid.innerHTML=filtered.map(a=>awardCardHTML(a)).join('');
  }
  loadAwardThumbs(filtered);
}
function awardCardHTML(a){
  return `<div class="award-card" onclick="viewAward('${a.id}')">
    <button class="del" onclick="event.stopPropagation();delAward('${a.id}')" title="删除">×</button>
    <img class="award-thumb" id="thumb_${a.id}" src="" alt="${esc(a.title)}">
    <div class="award-info">
      <h4>${esc(a.title)}</h4>
      <div class="award-meta"><span>${esc(a.category||'未分类')}</span><span>${esc(a.date||'')}</span></div>
    </div>
  </div>`;
}
function loadAwardThumbs(list){
  list.forEach(a=>{
    Store.getImage(a.imgKey).then(data=>{
      const el=document.getElementById('thumb_'+a.id);
      if(el&&data) el.src=data;
    }).catch(()=>{});
  });
}
function filterAward(c){
  App.awardFilter=c;
  $$('.cat-tags .cat-tag').forEach(b=>b.classList.toggle('active',b.textContent.trim()===c));
  renderAwardList();
}
function openAwardModal(){
  const body=`<div class="form-grid">
    <div class="field full"><label>奖项名称 *</label><input id="a_title" placeholder="如：国家励志奖学金"></div>
    <div class="field"><label>奖项类别</label><input id="a_cat" list="catList" placeholder="如：奖学金 / 竞赛 / 荣誉">
      <datalist id="catList">${['奖学金','竞赛获奖','荣誉称号','科技创新','其他'].map(c=>`<option value="${c}">`).join('')}</datalist></div>
    <div class="field"><label>获奖时间</label><input id="a_date" type="month"></div>
    <div class="field full"><label>奖状图片 *</label><input id="a_img" type="file" accept="image/*" style="padding:8px;">
      <span class="field-hint">支持 JPG / PNG，将压缩后保存到本地</span></div>
    <div class="field full"><label>备注</label><textarea id="a_note" rows="2" placeholder="可选"></textarea></div>
  </div>`;
  const foot=`<button class="btn btn-ghost" onclick="closeModal()">取消</button>
    <button class="btn btn-primary" onclick="saveAward()">保存</button>`;
  openModal('上传奖状',body,foot);
}
function saveAward(){
  const title=$('#a_title').value.trim();
  const file=$('#a_img').files[0];
  if(!title){ toast('请填写奖项名称'); return; }
  if(!file){ toast('请选择奖状图片'); return; }
  compressImage(file,1400,.82,dataURL=>{
    const imgKey=uid('img');
    Store.putImage(imgKey,dataURL).then(()=>{
      Store.addAward({title,category:$('#a_cat').value.trim()||'其他',date:$('#a_date').value,note:$('#a_note').value.trim(),imgKey});
      closeModal(); toast('奖状已保存到荣誉档案'); renderAwards();
    }).catch(e=>toast('图片保存失败：'+e.message));
  });
}
function compressImage(file,maxSize,quality,cb){
  const reader=new FileReader();
  reader.onload=(e)=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxSize||h>maxSize){ const r=Math.min(maxSize/w,maxSize/h); w=Math.round(w*r); h=Math.round(h*r); }
      const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',quality));
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
function viewAward(id){
  const a=Store.getAwards().find(x=>x.id===id); if(!a) return;
  Store.getImage(a.imgKey).then(data=>{
    if(data){ $('#viewerImg').src=data; $('#viewer').style.display='flex'; }
  });
}
function delAward(id){ if(confirm('确定删除这张奖状？')){ Store.deleteAward(id); toast('已删除'); renderAwards(); } }

/* ============================================================
 * 页面 7：设置与备份
 * ============================================================ */
function renderSettings(){
  const s=Store.getSettings();
  const courses=Store.getCourses();
  const awards=Store.getAwards();
  content.innerHTML=`<div class="page">
    <div class="grid-2">
      <div class="card">
        <div class="card-title">⚙ 换算规则</div>
        <div class="card-sub">选择适合你学校的绩点换算方式</div>
        ${Object.keys(GPA_RULES).map(k=>`<div class="stat-line">
          <span class="k"><b>${GPA_RULES[k].name}</b><br><span style="font-size:11px;color:var(--ink-3);">${GPA_RULES[k].desc}</span></span>
          <input type="radio" name="ruleRadio" value="${k}" ${s.rule===k?'checked':''} onchange="changeRule(this.value)" style="width:18px;height:18px;accent-color:var(--primary);">
        </div>`).join('')}
      </div>
      <div>
        <div class="card" style="margin-bottom:18px;">
          <div class="card-title">数据备份</div>
          <div class="card-sub">课程、设置可导出为 JSON 文件保存</div>
          <div class="row wrap">
            <button class="btn btn-primary" onclick="exportData()">⇩ 导出备份</button>
            <button class="btn btn-ghost" onclick="triggerImportData()">⇧ 导入备份</button>
          </div>
          <div class="stat-line" style="margin-top:16px;"><span class="k">课程数据</span><span class="v">${courses.length} 门</span></div>
          <div class="stat-line"><span class="k">奖状数据</span><span class="v">${awards.length} 项</span></div>
        </div>
        <div class="card">
          <div class="card-title">示例数据</div>
          <div class="card-sub">首次使用可载入示例数据体验系统功能</div>
          <button class="btn btn-ghost" onclick="loadDemoData()">载入示例数据</button>
          <p style="font-size:11px;color:var(--danger);margin-top:12px;">注意：载入示例会覆盖当前课程数据。</p>
        </div>
      </div>
    </div>
  </div>`;
}
function exportData(){
  const data=Store.exportAll();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='学业绩点备份_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('备份已导出');
}
function triggerImportData(){
  const inp=$('#fileInput'); inp.value=''; inp.accept='.json';
  inp.onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{ Store.importAll(JSON.parse(ev.target.result)); toast('数据已导入'); navigate('dashboard'); }
      catch(err){ toast('导入失败：'+err.message); }
    };
    reader.readAsText(file);
  };
  inp.click();
}
function loadDemoData(){ if(confirm('载入示例数据将覆盖当前课程，确定继续？')){ Store.loadDemo(); toast('示例数据已载入'); navigate('dashboard'); } }

/* ============================================================
 * 事件绑定 & 启动
 * ============================================================ */
function bindEvents(){
  $$('.nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
  $('#btnQuickAdd').onclick=()=>openCourseModal();
  $('#btnDemo').onclick=()=>loadDemoData();
  $('#modalClose').onclick=closeModal;
  $('#modalBackdrop').onclick=(e)=>{ if(e.target===$('#modalBackdrop')) closeModal(); };
  $('#viewerClose').onclick=()=>$('#viewer').style.display='none';
  $('#viewer').onclick=(e)=>{ if(e.target===$('#viewer')) $('#viewer').style.display='none'; };
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'){ closeModal(); $('#viewer').style.display='none'; }
  });
  // 侧栏小贴士轮换
  const tips=[
    '每学期及时录入成绩，规划更从容。',
    '绩点每提升 0.1，保研希望大一分。',
    '奖状及时归档，求职简历不慌张。',
    '合理规划剩余学分，目标更清晰。'
  ];
  let i=0; $('#sidebarTip').textContent=tips[0];
  setInterval(()=>{ i=(i+1)%tips.length; $('#sidebarTip').textContent=tips[i]; },5000);
}
document.addEventListener('DOMContentLoaded',()=>{
  bindEvents();
  navigate('dashboard');
});
