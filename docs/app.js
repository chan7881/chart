let workbookData = [];
let columns = [];

// 파일 로드 및 데이터 파싱
document.getElementById('btnLoad').addEventListener('click', () => {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert('파일을 선택해주세요.');

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // 데이터 추출 시 null 값 보존 및 정확한 행 단위 파싱
    workbookData = XLSX.utils.sheet_to_json(ws, { defval: null });
    
    if (workbookData.length > 0) {
      columns = Object.keys(workbookData[0]);
      populateSelectors();
      renderCheckboxes();
      alert('데이터 로드 성공!');
    }
  };
  reader.readAsArrayBuffer(file);
});

function populateSelectors() {
  const xSel = document.getElementById('xAxisMain');
  const ySel = document.getElementById('yAxisMain');
  xSel.innerHTML = '<option value="">X축 선택</option>';
  ySel.innerHTML = '<option value="">Y축(주) 선택</option>';
  
  columns.forEach(col => {
    xSel.add(new Option(col, col));
    ySel.add(new Option(col, col));
  });
}

function renderCheckboxes() {
  const area = document.getElementById('columnsArea');
  area.innerHTML = '';
  columns.forEach(col => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-sm';
    label.innerHTML = `<input type="checkbox" name="yFields" value="${col}"> ${col}`;
    area.appendChild(label);
  });
}

// 차트 생성 버튼 클릭 시 호출
document.getElementById('btnPlot').addEventListener('click', () => {
  const xCol = document.getElementById('xAxisMain').value;
  const selectedY = Array.from(document.querySelectorAll('input[name="yFields"]:checked')).map(cb => cb.value);

  if (!xCol || selectedY.length === 0) return alert('X축과 최소 하나 이상의 데이터를 선택하세요.');

  const traces = selectedY.map(yCol => {
    // [핵심 수정]: X와 Y 데이터를 행(row) 단위로 묶어서 추출
    let pairedData = workbookData
      .map(row => ({
        x: row[xCol],
        y: row[yCol]
      }))
      // 유효하지 않은 데이터(null, undefined) 필터링
      .filter(item => item.x !== null && item.y !== null);

    // [핵심 수정]: X축 값 기준으로 정렬 (숫자형인 경우 필수)
    if (!isNaN(pairedData[0]?.x)) {
      pairedData.sort((a, b) => Number(a.x) - Number(b.x));
    }

    return {
      x: pairedData.map(d => d.x),
      y: pairedData.map(d => Number(d.y)),
      name: yCol,
      mode: 'lines+markers',
      type: 'scatter'
    };
  });

  const layout = {
    title: '데이터 분석 차트',
    xaxis: { title: xCol, automargin: true },
    yaxis: { title: 'Value', automargin: true },
    hovermode: 'closest',
    template: 'plotly_white'
  };

  Plotly.newPlot('previewArea', traces, layout);
});
