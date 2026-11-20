import test from 'node:test';
import assert from 'node:assert/strict';
import {entryCards, entryLayout} from '../public/pool-entry-filter.mjs';
import {blankDraft, buildRows, pools} from '../public/pool-center-core.mjs';

const asset = {
  id:'dt', ip:'dt', category:'小卡', series:'2026.10 香港快闪',
  search_aliases:['DT', 'DewTee'],
  members:'["dew","tee","隐藏"]', member_images:'{}',
  variants:[{id:'dew-card',name:'dew'},{id:'tee-card',name:'tee'},{id:'secret-card',name:'隐藏'}]
};
test('CP aliases show all variants; member/version terms narrow matching cards', () => {
  assert.equal(entryCards(asset,' DEW-TEE ').length,3);
  assert.deepEqual(entryCards(asset,'dt tee').map(c=>c.member),['tee']);
  assert.deepEqual(entryCards(asset,'隐藏').map(c=>c.member),['隐藏']);
  assert.equal(entryCards(asset,'sea').length,0);
});
test('filled filter intersects search; zero and blank cards are excluded', () => {
  const quantities={'dew-card':'2','tee-card':'0','secret-card':''};
  assert.deepEqual(entryCards(asset,'',quantities,true).map(c=>c.member),['dew']);
  assert.equal(entryCards(asset,'tee',quantities,true).length,0);
});
test('filtering preserves draft quantities, costs and the full submission', () => {
  const d=blankDraft();d.quantities={'dew-card':2,'tee-card':3};
  d.costs={'dew-card':'10','tee-card':'12'};
  const pool=pools([asset])[0], before=JSON.stringify(d), rows=buildRows(pool,d);
  entryCards(asset,'dew',d.quantities,true);
  assert.equal(JSON.stringify(d),before);
  assert.deepEqual(buildRows(pool,d),rows);
  assert.equal(rows.length,2);
});
test('three CPs per row, two small teams or one large team; multiple CP editions stay a pair', () => {
  assert.equal(entryLayout(asset),'pair');
  assert.equal(entryLayout({...asset,ip:'fb',members:JSON.stringify(Array.from({length:9},(_,i)=>'version'+i))}),'pair');
  assert.equal(entryLayout({...asset,ip:'LYKN',members:'["william","nut","hong","tui","lego"]'}),'team');
  assert.equal(entryLayout({...asset,ip:'LYKN',members:'["william","nut","hong","tui","lego","隐藏"]'}),'wide');
  assert.equal(entryLayout({...asset,ip:'CLO’VER',members:JSON.stringify(Array.from({length:8},(_,i)=>'version'+i))}),'wide');
});
