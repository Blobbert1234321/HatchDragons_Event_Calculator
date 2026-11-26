// Browser-only Excel export. Numeric values retain the calculator's precision.
const enc=new TextEncoder();
const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRels=entries=>`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries.map(([id,type,target])=>`<Relationship Id="${id}" Type="${REL}/${type}" Target="${xml(target)}"/>`).join('')}</Relationships>`;
// ZIP with stored entries keeps downloads dependency-free and works offline.
function zip(files){
  const chunks=[],central=[];let offset=0;
  const header=(size)=>{const b=new Uint8Array(size);return[b,new DataView(b.buffer)];};
  for(const [path,content]of files){const name=enc.encode(path),data=enc.encode(content);let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
    const [h,d]=header(30);d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);d.setUint16(12,33,true);d.setUint32(14,crc,true);d.setUint32(18,data.length,true);d.setUint32(22,data.length,true);d.setUint16(26,name.length,true);chunks.push(h,name,data);
    const [c,v]=header(46);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);central.push(c,name);offset+=30+name.length+data.length;
  }
  const length=central.reduce((a,b)=>a+b.length,0),[end,v]=header(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,length,true);v.setUint32(16,offset,true);
  const out=new Uint8Array(offset+length+22);let pos=0;for(const b of [...chunks,...central,end]){out.set(b,pos);pos+=b.length;}return out;
}
export function workbookSheets(all,selected=0){
  const s=all.scenarios[selected];if(!s)throw Error('Calculate a plan before downloading.');
  const c=s.config,p=s.best,cooking=s.type==='cooking'||all.type==='cooking';
  const a=cooking?'Fancy bags':'Fish hurries',b=cooking?'Instant cooks':'Golden hooks';
  const sheets=[];
  const add=(name,headers,rows,types=[],note='',charts=[])=>{const sheet={name,title:name,headers,rows,types,note,charts};sheets.push(sheet);return sheet;};
  add('Summary',['Your plan','Value'],[
    ['Event',cooking?'Cooking':'Fishing'],['Daily actions',c.dailyActions],['Days planned',c.days],
    ['Planning from',c.remainingEventMode?'Current progress':'Event start'],['Desired completions',c.desiredCompletions],
    ['Starting points',c.startPoints],['Total target points',c.totalTarget],['Points still needed',c.remainingTarget],['Expected future points',p.score],
    [`${a} owned`,cooking?c.fancyBagsOwned:c.fishHurriesOwned],[`${b} owned`,cooking?c.instantCooksOwned:c.goldenHooksOwned],
    [`${a} to use`,p.a],[`${b} to use`,p.b],[`${a} to buy`,p.buyA],[`${b} to buy`,p.buyB],
    ['Gems for resources',p.resourceGems],['Gems for multiplier',p.multiplierGems],['ADDITIONAL GEMS NEEDED',p.totalGems],
    ['Points multiplier enabled',c.usePointsMultiplier?'Yes':'No'],['Days with multiplier',c.boostDays],
    ...(p.policy?[['Golden hook policy',p.policy]]:[])
  ],['text','decimal'],'Exported results. Change inputs on the website to calculate a new plan.');
  // Whole counts and gems remain whole; fractional expected hook use is retained.
  sheets[0].integerRows=[1,4,9,10,11,13,14,15,16,17,...(cooking?[12]:[])];
  add('Schedule',['Day','Hours from '+(c.remainingEventMode?'now':'start'),'Round','Last reward claimed','Next reward','Progress to next reward','Points this interval','Points from now','Total event points','Completions reached'],s.schedule.map(d=>[d.day,d.hours,d.round,d.reward,d.nextReward??'',d.progress/100,d.dailyPoints,d.pointsFromNow,d.cumulative,d.completions.map(x=>`Round ${x}`).join(', ')]),['decimal','decimal','integer','integer','integer','percent','decimal','decimal','decimal','text'],'Steady progress targets for the selected daily activity level.');
  if(all.scenarios.length>1)add('Daily comparison',['Actions per day',`${a} to use`,`${b} to use`,`${a} to buy`,`${b} to buy`,'Expected points','Resource gems','Multiplier gems','Extra gems'],all.scenarios.map(r=>[r.config.dailyActions,r.best.a,r.best.b,r.best.buyA,r.best.buyB,r.best.score,r.best.resourceGems,r.best.multiplierGems,r.best.totalGems]),['integer','integer',cooking?'integer':'decimal','integer','integer','decimal','integer','integer','integer'],'Each row uses the same inventory and completion goal.',[{x:0,y:8,title:'Extra gems by daily activity',xTitle:'Actions per day',yTitle:'Extra gems'}]);
  if(cooking){
    add('Breakdown',['Ingredient','Starting inventory','From basic bags','From fancy bags','Total available','Used','With bonus','Without bonus','Left over','Points'],s.details.map(d=>[d.name,d.starting,d.fromBasic,d.fromFancy,d.collected,d.used,d.bonusCooked,d.normalCooked,d.leftover,d.points]),['text'],'Expected ingredient counts for the planning period. All six items from each bag are kept.');
    add('Bonus detail',['Ingredient','Base points per item','Bonus per item','Bonus enabled','Free bonus items','Instant bonus items','Cooked at 1.5x','Base points earned','Bonus points earned','Multiplier extra points'],s.details.map(d=>[d.name,d.basePoints,d.bonusPerItem,d.bonusEnabled?'Yes':'No',d.freeBonus,d.instantBonus,d.boostedUsed,d.baseEarned,d.bonusEarned,d.multiplierExtra]),['text','decimal','decimal','text']);
  }else{
    add('Breakdown',['Fish color','Spawned','Successful catches','Fish received','Starting inventory','Hooks used','Combos','Traded fish','Left over','Points'],s.details.map(d=>[d.name,d.spawned,d.catches,d.received,d.starting,d.hooked,d.combos,d.traded,d.leftover,d.points]),['text'],'Expected fish counts for the planning period. Reserved leftovers do not earn points.');
    add('Combo detail',['Fish color','Points per fish','Ending combo progress','Leftover shortfall'],s.details.map(d=>[d.name,d.pointsPerFish,d.comboProgress,d.shortfall]),['text']);
  }
  add('Resource options',[`${a} to use`,`${b} to use`,`${a} to buy`,`${b} to buy`,'Expected points','Resource gems','Multiplier gems','Extra gems'],s.tradeoffs.map(t=>[t.a,t.b,t.buyA,t.buyB,t.score,t.resourceGems,t.multiplierGems,t.totalGems]),['integer',cooking?'integer':'decimal','integer','integer','decimal','integer','integer','integer'],'Resource combinations tested for the selected daily activity level.',[{x:0,y:7,title:'Extra gems by resource combination',xTitle:a,yTitle:'Extra gems'},{x:0,y:1,title:'Resource trade-offs',xTitle:a,yTitle:b}]);
  return sheets;
}
const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.0"/><numFmt numFmtId="165" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts><fonts count="4"><font><sz val="11"/><color rgb="FFE6EAF2"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="20"/><color rgb="FFE6EAF2"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFE6EAF2"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF303C52"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF171E2B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="3" applyFill="1" borderId="0"/></cellStyleXfs><cellXfs count="8">${[0,164,165,166].map(n=>`<xf numFmtId="${n}" fontId="0" fillId="3" applyFill="1" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`).join('')}<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" applyFill="1" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="3" applyFill="1" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="165" fontId="3" fillId="3" applyFill="1" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function cell(value,address,style){return typeof value==='number'&&Number.isFinite(value)?`<c r="${address}" s="${style}"><v>${value}</v></c>`:`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}
function worksheet(s,hasDrawing){
  const last=col(s.headers.length-1),rows=[];
  // Paint a bounded canvas, including the space behind charts and notes.
  const height=hasDrawing?s.rows.length+7+(s.charts.length-1)*20+20:s.rows.length+8;
  const width=Math.max(s.headers.length,hasDrawing?6:2);
  for(let r=1;r<=height;r++){
    const cells=[];
    for(let i=0;i<width;i++){
      let value='',style=0;
      if(r===1&&i===0){value=s.title;style=5;}
      else if(r===2&&i===0){value=s.note;style=6;}
      else if(r===4&&i<s.headers.length){value=s.headers[i];style=4;}
      else if(r>=5&&r<s.rows.length+5&&i<s.headers.length){
        value=s.rows[r-5][i];style={text:0,decimal:1,integer:2,percent:3}[s.types[i]??'decimal'];
        if(s.name==='Summary'&&i===1&&s.integerRows.includes(r-5))style=2;
        if(s.name==='Summary'&&r===22)style=7;
      }
      cells.push(cell(value,`${col(i)}${r}`,style));
    }
    rows.push(`<row r="${r}" ht="${r===4?44:r<=2?34:25}" customHeight="1">${cells.join('')}</row>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="25"/><cols>${s.headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${s.name==='Summary'?(i===0?38:32):(i===0?23:21)}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData>${s.rows.length?`<autoFilter ref="A4:${last}${s.rows.length+4}"/>`:''}<mergeCells count="2"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/>${hasDrawing?'<drawing r:id="rId1"/>':''}</worksheet>`;
}
function chart(s,g,id){
  const series=(index,tag)=>`<c:${tag}><c:numRef><c:f>${xml(`'${s.name}'!$${col(index)}$5:$${col(index)}$${s.rows.length+4}`)}</c:f><c:numCache><c:formatCode>#,##0.0</c:formatCode><c:ptCount val="${s.rows.length}"/>${s.rows.map((r,i)=>`<c:pt idx="${i}"><c:v>${r[index]}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:${tag}>`;
  const title=t=>`<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1200"><a:solidFill><a:srgbClr val="E6EAF2"/></a:solidFill></a:rPr><a:t>${xml(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  const axis=(n,other,pos,t)=>`<c:valAx><c:axId val="${n}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${title(t)}<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${other}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100"><a:solidFill><a:srgbClr val="E6EAF2"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:valAx>`;
  return `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}"><c:lang val="en-US"/><c:chart>${title(g.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:spPr><a:ln w="25400"><a:solidFill><a:srgbClr val="B5A0FF"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="B5A0FF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="B5A0FF"/></a:solidFill></a:ln></c:spPr></c:marker>${series(g.x,'xVal')}${series(g.y,'yVal')}<c:smooth val="0"/></c:ser><c:axId val="${id*10+1}"/><c:axId val="${id*10+2}"/></c:scatterChart>${axis(id*10+1,id*10+2,'b',g.xTitle)}${axis(id*10+2,id*10+1,'l',g.yTitle)}<c:spPr><a:solidFill><a:srgbClr val="171E2B"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="171E2B"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100"><a:solidFill><a:srgbClr val="E6EAF2"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:chartSpace>`;
}
export function createSpreadsheet(all,selected=0){
  const sheets=workbookSheets(all,selected),files=[['_rels/.rels',packageRels([['rId1','officeDocument','xl/workbook.xml']])],['xl/styles.xml',styles]];
  const overrides=[['/xl/workbook.xml','spreadsheetml.sheet.main+xml'],['/xl/styles.xml','spreadsheetml.styles+xml']];
  let chartId=0,drawingId=0;
  sheets.forEach((s,i)=>{
    const graphs=s.rows.length>1?s.charts:[];files.push([`xl/worksheets/sheet${i+1}.xml`,worksheet(s,graphs.length>0)]);overrides.push([`/xl/worksheets/sheet${i+1}.xml`,'spreadsheetml.worksheet+xml']);
    if(graphs.length){drawingId++;const drawingRels=[],anchors=[];
      graphs.forEach((g,k)=>{chartId++;files.push([`xl/charts/chart${chartId}.xml`,chart(s,g,chartId)]);overrides.push([`/xl/charts/chart${chartId}.xml`,'drawingml.chart+xml']);drawingRels.push([`rId${k+1}`,'chart',`../charts/chart${chartId}.xml`]);
        const row=s.rows.length+7+k*20;anchors.push(`<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row+18}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${k+2}" name="${xml(g.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${k+1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`);
      });
      files.push([`xl/drawings/drawing${drawingId}.xml`,`<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}">${anchors.join('')}</xdr:wsDr>`],[`xl/drawings/_rels/drawing${drawingId}.xml.rels`,packageRels(drawingRels)],[`xl/worksheets/_rels/sheet${i+1}.xml.rels`,packageRels([['rId1','drawing',`../drawings/drawing${drawingId}.xml`]])]);overrides.push([`/xl/drawings/drawing${drawingId}.xml`,'drawing+xml']);
    }
  });
  files.push(['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],['xl/_rels/workbook.xml.rels',packageRels([...sheets.map((s,i)=>[`rId${i+1}`,'worksheet',`worksheets/sheet${i+1}.xml`]),[`rId${sheets.length+1}`,'styles','styles.xml']])],['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([path,type])=>`<Override PartName="${path}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/>`).join('')}</Types>`]);
  return zip(files);
}
