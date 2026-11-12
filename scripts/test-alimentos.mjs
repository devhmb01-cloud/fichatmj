import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialFoodDemo, foodMetrics, receiveFood, addFoodItem, setFoodBasketQuantity,
  setFoodMonthlyFamilies, deliverFoodBasket, receiveFoodLot, registerFoodLoss,
} from '../src/lib/alimentos/model.ts';

const iso = '2026-11-07T12:00:00.000Z';
test('demo exclusivamente fictícia e independente', () => {
  const a = initialFoodDemo(); a.items[0].stock = 0;
  assert.equal(initialFoodDemo().items[0].stock, 90);
  assert.ok(initialFoodDemo().families.every(f => f.code.startsWith('FAM-SIM-')));
});
test('quantidade de cestas depende do item limitante', () => {
  const m = foodMetrics(initialFoodDemo());
  assert.equal(m.basketsPossible, 22);
  assert.equal(m.monthsCoverage, .55);
  assert.equal(m.needs[0].name, 'Leite');
  assert.equal(m.nextMonthShortages[0].missingNextMonth, 35);
});
test('entradas alteram a cobertura sem mutar estado anterior', () => {
  const s = initialFoodDemo();
  const next = receiveFood(s,'f-leite',80);
  assert.equal(next.items.find(x=>x.id==='f-leite').stock,125);
  assert.equal(s.items.find(x=>x.id==='f-leite').stock,45);
  assert.equal(foodMetrics(next).basketsPossible, 35);
});
test('não permite entradas inválidas, frações ou IDs inexistentes', () => {
  for (const n of [0,-1,1.5,NaN,10001]) assert.throws(()=>receiveFood(initialFoodDemo(),'f-cafe',n));
  assert.throws(()=>receiveFood(initialFoodDemo(),'nada',1));
});
test('cadastro evita nomes/embalagens duplicadas e valida as unidades', () => {
  const a = addFoodItem(initialFoodDemo(),'f-sardinha','Sardinha','lata de 125 g',1);
  assert.equal(a.items.length,10);
  assert.throws(()=>addFoodItem(a,'f-duplicado','sardinha','lata de 125 g',1));
  assert.throws(()=>addFoodItem(a,'id','','lata',1));
});
test('cesta padrão aceita zero e altera planejamento', () => {
  const a = setFoodBasketQuantity(initialFoodDemo(),'f-leite',0);
  assert.equal(foodMetrics(a).basketsPossible,35);
  const b = setFoodMonthlyFamilies(a,35);
  assert.equal(foodMetrics(b).monthsCoverage,1);
  assert.throws(()=>setFoodMonthlyFamilies(a,0));
});
test('distribuição baixa itens e registra conteúdo imutável', () => {
  const a = initialFoodDemo();
  const b = deliverFoodBasket(a,'sim-001','deliver-1',iso);
  assert.equal(b.items.find(x=>x.id==='f-leite').stock,43);
  assert.equal(a.items.find(x=>x.id==='f-leite').stock,45);
  assert.equal(b.distributions[0].lines.find(x=>x.name==='Leite').quantity,2);
  assert.equal(foodMetrics(b).basketsPossible,21);
  const c = setFoodBasketQuantity(b,'f-leite',3);
  assert.equal(c.distributions[0].lines.find(x=>x.name==='Leite').quantity,2);
});
test('mesma família não recebe duas cestas no mês', () => {
  const a = deliverFoodBasket(initialFoodDemo(),'sim-001','deliver-1',iso);
  assert.throws(()=>deliverFoodBasket(a,'sim-001','deliver-2','2026-11-22T10:00:00Z'),/já recebeu/);
  assert.doesNotThrow(()=>deliverFoodBasket(a,'sim-002','deliver-2',iso));
  assert.doesNotThrow(()=>deliverFoodBasket(a,'sim-001','deliver-3','2026-12-01T12:00:00Z'));
});
test('estoque insuficiente cancela integralmente a entrega', () => {
  const a = setFoodBasketQuantity(initialFoodDemo(),'f-leite',100);
  assert.throws(()=>deliverFoodBasket(a,'sim-001','deliver-1',iso),/Estoque insuficiente/);
  assert.equal(a.distributions.length,0);
  assert.equal(a.items.find(x=>x.id==='f-leite').stock,45);
});
test('cesta vazia não permite entrega nem cobertura enganosa', () => {
  let a = initialFoodDemo();
  for(const item of a.items) a=setFoodBasketQuantity(a,item.id,0);
  assert.equal(foodMetrics(a).monthsCoverage,null);
  assert.throws(()=>deliverFoodBasket(a,'sim-001','deliver-1',iso),/Configure/);
});
test('família inexistente não recebe entrega', () => {
  assert.throws(()=>deliverFoodBasket(initialFoodDemo(),'random','deliver-1',iso),/família cadastrada/);
});

test('validade bloqueia lote vencido e reduz cobertura quando o lote vence', () => {
  const state=initialFoodDemo();
  const today=new Date();
  const yesterday=new Date(today.getTime()-3*86400000).toISOString().slice(0,10);
  const lot=state.lots.find(l=>l.itemId==='f-leite');
  lot.expiresOn=yesterday;
  const m=foodMetrics(state);
  assert.equal(m.expiredPackages,45);
  assert.equal(m.basketsPossible,0);
  assert.equal(m.usablePackages,initialFoodDemo().items.reduce((n,i)=>n+i.stock,0)-45);
  assert.throws(()=>receiveFoodLot(state,'f-leite',2,yesterday),/vencidos/);
});
test('perdas diminuem estoque, ficam no histórico e não são duplicadas',()=>{
  const a=initialFoodDemo();
  const lot=a.lots.find(l=>l.itemId==='f-leite');
  const b=registerFoodLoss(a,lot.id,3,'damaged','loss-demo-1');
  assert.equal(b.items.find(i=>i.id==='f-leite').stock,42);
  assert.equal(b.lots.find(l=>l.id===lot.id).remaining,42);
  assert.equal(foodMetrics(b).recordedLosses,3);
  assert.equal(a.items.find(i=>i.id==='f-leite').stock,45);
  assert.throws(()=>registerFoodLoss(b,lot.id,4,'damaged','loss-demo-1'),/já registrada/);
  assert.throws(()=>registerFoodLoss(b,lot.id,100,'damaged'),/maior que o saldo/);
});

test('lote antigo recebe data sem alterar saldo e mantém auditoria',()=>{
  const state=initialFoodDemo();
  const lot=state.lots.find(l=>l.itemId==='f-leite');
  const future='2027-02-28';
  const reviewed=confirmFoodLotExpiry(state,lot.id,future,'check-1');
  assert.equal(reviewed.lots.find(l=>l.id===lot.id).expiresOn,future);
  assert.equal(reviewed.items.find(i=>i.id==='f-leite').stock,45);
  assert.equal(reviewed.expiryUpdates.length,1);
  assert.equal(confirmFoodLotExpiry(reviewed,lot.id,future,'check-1'),reviewed);
  assert.throws(()=>confirmFoodLotExpiry(reviewed,lot.id,'2027-03-01','check-2'),/já possui/);
  assert.throws(()=>confirmFoodLotExpiry(state,lot.id,'2027-02-30','check-3'),/válida/);
});
test('validade passada corrigida exclui lote de cestas sem descarte automático',()=>{
  const state=initialFoodDemo();
  const lot=state.lots.find(l=>l.itemId==='f-leite');
  const reviewed=confirmFoodLotExpiry(state,lot.id,'2025-06-20','check-past');
  assert.equal(foodMetrics(reviewed).basketsPossible,0);
  assert.equal(foodMetrics(reviewed).expiredPackages,45);
  assert.equal(foodMetrics(reviewed).totalPackages,foodMetrics(state).totalPackages);
  assert.equal(reviewed.losses.length,0);
});
