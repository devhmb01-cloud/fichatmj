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
  await page.locator('.food-form select').first().selectOption('sim-001');
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
  // The primary sidebar must not shrink or change headings between modules.
  const navigationHrefs = ['/', '/familias', '/novo', '/relatorios', '/bazar', '/alimentos'];
  const routesToCheck = [
    ['/', '/'],
    ['/familias', '/familias'],
    ['/bazar', '/bazar'],
    ['/bazar/estoque', '/bazar'],
    ['/alimentos', '/alimentos'],
    ['/alimentos/cesta', '/alimentos'],
    ['/alimentos/entregas', '/alimentos'],
  ];
  for (const [route, active] of routesToCheck) {
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    assert.deepEqual(
      await page.locator('aside nav a').evaluateAll(links => links.map(link => link.getAttribute('href'))),
      navigationHrefs,
      'Menu lateral deve manter todos os links em ' + route,
    );
    assert.equal(await page.locator('aside .brand small').innerText(), 'GESTÃO DA ONG');
    assert.equal(await page.locator('aside nav a[aria-current="page"]').getAttribute('href'), active);
  }
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const desktopPage = await desktop.newPage();
  try {
    for (const [route, active] of routesToCheck) {
      await desktopPage.goto(origin + route, { waitUntil: 'networkidle' });
      assert.deepEqual(
        await desktopPage.locator('aside nav a').evaluateAll(links => links.map(link => link.getAttribute('href'))),
        navigationHrefs,
        'Sidebar desktop deve manter todos os links em ' + route,
      );
      assert.equal(await desktopPage.locator('aside nav a[aria-current="page"]').getAttribute('href'), active);
      assert.equal(await desktopPage.locator('aside .nav-label').innerText(), 'NAVEGAÇÃO PRINCIPAL');
    }
  } finally { await desktop.close(); }
  // Regression: route transitions via Next.js Links, not only page.goto reloads.
  for (const ctx of [context, await browser.newContext({ viewport: {width: 1366, height: 900} })]) {
    const testPage = await ctx.newPage();
    try {
      await testPage.goto(origin + '/', { waitUntil: 'networkidle' });
      for (const [href, heading] of [
        ['/bazar', 'Bazar'],
        ['/alimentos', 'Alimentos e Cestas'],
        ['/familias', null],
        ['/bazar', 'Bazar'],
        ['/alimentos', 'Alimentos e Cestas'],
      ]) {
        await testPage.locator('.app-primary-nav a[href="' + href + '"]').click();
        await testPage.waitForURL(url => url.pathname === href);
        if (heading) await testPage.getByRole('heading', {name: heading, level: 1}).waitFor();
        const stats = await testPage.evaluate(() => {
          const sidebar = document.querySelector('.app-sidebar');
          const nav = document.querySelector('.app-primary-nav');
          const links = Array.from(nav?.querySelectorAll('a') ?? []);
          const box = sidebar?.getBoundingClientRect();
          return {
            title: document.querySelector('.brand small')?.textContent,
            path: location.pathname,
            sticky: sidebar ? getComputedStyle(sidebar).position : null,
            overflow: nav ? getComputedStyle(nav).overflowX : null,
            allVisible: links.every(a => {
              const r = a.getBoundingClientRect();
              const style = getComputedStyle(a);
              return r.width > 0 && r.height > 0 && r.left >= -1
                && r.right <= innerWidth + 1
                && style.visibility !== 'hidden' && style.display !== 'none';
            }),
            links: links.map(a => a.getAttribute('href')),
            active: nav?.querySelector('a[aria-current="page"]')?.getAttribute('href'),
            sidebarTop: box?.top,
          };
        });
        assert.equal(stats.title, 'GESTÃO DA ONG');
        assert.deepEqual(stats.links, navigationHrefs);
        assert.equal(stats.active, href);
        assert.equal(stats.sticky, 'sticky');
        assert.equal(stats.overflow, 'visible');
        assert.ok(stats.allVisible, 'Todos os 6 links devem estar visíveis: ' + JSON.stringify(stats));
        assert.ok((stats.sidebarTop ?? 100) >= -1 && (stats.sidebarTop ?? 100) <= 1, 'Sidebar não deve sair da tela: ' + JSON.stringify(stats));
      }
    } finally { await testPage.close(); if (ctx !== context) await ctx.close(); }
  }
  console.log('PASS: SPA clicks keep all 6 sidebar links visible, sticky and styled consistently on mobile/desktop');
  console.log('PASS: sidebar fixed across modules and active link correct on mobile and desktop');

  console.log('PASS: Alimentos mobile navigation, stock, basket, family delivery, and zero horizontal overflow');
} finally { await browser.close(); }
