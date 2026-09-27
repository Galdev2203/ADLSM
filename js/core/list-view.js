const clampPage=(page,total,pageSize)=>Math.min(Math.max(1,page),Math.max(1,Math.ceil(total/pageSize)));

export function createListView({
  container,
  pagination,
  cardsButton,
  tableButton,
  pageSize=8,
  getRows,
  renderCards,
  renderTable,
  onRender
}){
  let mode='cards';
  let page=1;

  const render=()=>{
    const rows=getRows();
    const total=rows.length;
    page=clampPage(page,total,pageSize);
    const pageRows=rows.slice((page-1)*pageSize,page*pageSize);

    cardsButton?.classList.toggle('active',mode==='cards');
    tableButton?.classList.toggle('active',mode==='table');

    container.classList.toggle('list-view-table',mode==='table');
    container.innerHTML=mode==='table' ? renderTable(pageRows) : renderCards(pageRows);
    onRender?.(pageRows);

    const pages=Math.max(1,Math.ceil(total/pageSize));
    if(!pagination)return;
    if(total<=pageSize){
      pagination.hidden=true;
      pagination.innerHTML='';
      return;
    }

    pagination.hidden=false;
    const start=(page-1)*pageSize+1;
    const end=Math.min(page*pageSize,total);
    const buttons=Array.from({length:pages},(_,i)=>i+1).map(number=>
      `<button type="button" class="list-page-button ${number===page?'active':''}" data-page="${number}">${number}</button>`
    ).join('');

    pagination.innerHTML=`
      <div class="list-pagination-info">Mostrando ${start}–${end} de ${total}</div>
      <div class="list-pagination-buttons">
        <button type="button" class="list-page-button" data-page="${page-1}" ${page===1?'disabled':''}>‹</button>
        ${buttons}
        <button type="button" class="list-page-button" data-page="${page+1}" ${page===pages?'disabled':''}>›</button>
      </div>`;

    pagination.querySelectorAll('[data-page]').forEach(button=>{
      button.addEventListener('click',()=>{
        const next=Number(button.dataset.page);
        if(next>=1&&next<=pages&&next!==page){
          page=next;
          render();
        }
      });
    });
  };

  cardsButton?.addEventListener('click',()=>{
    if(mode==='cards')return;
    mode='cards';
    page=1;
    render();
  });

  tableButton?.addEventListener('click',()=>{
    if(mode==='table')return;
    mode='table';
    page=1;
    render();
  });

  return {
    render,
    resetPage(){page=1;render()},
    setMode(next){mode=next==='table'?'table':'cards';page=1;render()},
    getMode(){return mode}
  };
}
