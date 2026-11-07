import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const origin='http://127.0.0.1:3100';
const browser=await chromium.launch({ headless:true,
  ...(existsSync('/usr/bin/google-chrome') ? {executablePath:'/usr/bin/google-chrome'} : {channel:'chrome'}),
  args:['--no-sandbox'] });
const context=await browser.newContext({ viewport:{width:390,height:844}, isMobile:true,hasTouch:true });
const page=await context.newPage();
mkdirSync('artifacts',{recursive:true});
try {
  await page.goto(origin+'/alimentos',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Alimentos e Cestas',level:1}).waitFor();
  await page.screenshot({path:'artifacts/alimentos-painel.png',fullPage:true});
  await page.getByRole('link',{name:'Estoque',exact:true}).click();
  await page.getByRole('heading',{name:'Estoque de alimentos'}).waitFor();
  await page.locator('.food-form select').first().selectOption('f-leite');
  await page.getByLabel('Quantidade de embalagens').fill('80');
  await page.getByRole('button',{name:'Adicionar ao estoque'}).click();
  await page.getByText('Entrada registrada (simulação)').waitFor();
  assert.match(await page.locator('.food-stock-line').filter({hasText:'Leite'}).innerText(),/125/);
  await page.screenshot({path:'artifacts/alimentos-estoque.png',fullPage:true});
  await page.getByRole('link',{name:'Cesta padrão'}).click();
  await page.getByRole('heading',{name:'Cesta padrão'}).waitFor();
  await page.screenshot({path:'artifacts/alimentos-cesta.png',fullPage:true});
  await page.getByRole('link',{name:'Entregas'}).click();
  await page.getByRole('heading',{name:'Distribuição de cestas'}).waitFor();
  await page.getByLabel('Família',{exact:true}).selectOption('sim-001');
  await page.getByLabel(/Confirmo que a cesta/).check();
  await page.getByRole('button',{name:'Confirmar entrega e baixar estoque'}).click();
  await page.getByText('Cesta entregue e estoque atualizado (simulação)').waitFor();
  assert.match(await page.locator('.food-history').innerText(),/FAM-SIM-001/);
  await page.screenshot({path:'artifacts/alimentos-entregas.png',fullPage:true});
  for(const path of ['/alimentos','/alimentos/estoque','/alimentos/cesta','/alimentos/entregas']){
    await page.goto(origin+path,{waitUntil:'networkidle'});
    const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    assert.ok(dims.scroll<=dims.viewport+1,`${path} horizontal overflow: ${JSON.stringify(dims)}`);
  }
  console.log('PASS: Alimentos mobile navigation, stock, basket, family delivery, and zero horizontal overflow');
} finally { await browser.close(); }
