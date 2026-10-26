import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ChairGrade from '../pages/Chair/GradeInternship';
import MemberGrade from '../pages/Member/GradeInternship';
import ChairEarly from '../pages/Chair/EarlyEvaluation';
import MemberEarly from '../pages/Member/EarlyEvaluation';
import ChairList from '../pages/Chair/StudentList';
import MemberList from '../pages/Member/StudentList';
import api from '../services/api';
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../services/authService', () => ({ getCurrentUser: () => ({ department: { id: 1 }, role: { name: 'Commission Chair' } }), getToken: () => 'review-token' }));
const terms=[{id:1,name:'Review Summer',startDate:'2026-06-01T00:00:00Z',endDate:'2026-09-01T00:00:00Z'},{id:2,name:'Review Next',startDate:'2027-06-01T00:00:00Z',endDate:'2027-09-01T00:00:00Z'}];
const row=(id,name,internshipId,order='STAJ1')=>({id,studentNumber:id,name,currentInternship:{id:internshipId,company:'Company',startDate:'2026-07-01T00:00:00Z',endDate:'2026-08-01T00:00:00Z',grade:null,internshipOrder:order,durationDays:20},previousInternship:null});
const separate=[row('1001','Alice Test',101),row('1002','Bob Test',102)];
const same=[row('1001','Alice Test',101),row('1001','Alice Test',102,'STAJ2')];
beforeEach(()=>{
 jest.clearAllMocks();
 api.get.mockImplementation(async url=>({data:url.endsWith('/terms')?terms:separate}));
 api.post.mockImplementation(async url=>url.endsWith('generate-report')?{data:new Blob(['test'])}:{data:{successCount:2,errorCount:0,errors:[]}});
 jest.spyOn(window,'confirm').mockReturnValue(false);
 window.URL.createObjectURL=jest.fn(()=> 'blob:review');window.URL.revokeObjectURL=jest.fn();
 jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
});
afterEach(()=>jest.restoreAllMocks());
async function mount(Component,rows=separate){api.get.mockImplementation(async url=>({data:url.endsWith('/terms')?terms:rows}));const result=render(<Component/>);await screen.findAllByText('Alice Test');return result;}
function grade(name,value){fireEvent.change(within(screen.getByText(name).closest('tr')).getByRole('combobox'),{target:{value}});}
const gradeCall=()=>api.post.mock.calls.find(([url])=>url.endsWith('grade-internships-bulk'));
const reportCall=()=>api.post.mock.calls.find(([url])=>url.endsWith('generate-report'));
async function early(Component,errors=false){
 const view=await mount(Component,same);
 fireEvent.click(screen.getAllByRole('checkbox')[1]);
 fireEvent.click(screen.getByText(/Erken Değerlendir \(/));
 const modal=document.querySelector('.evaluation-item');
 fireEvent.change(within(modal).getByRole('combobox'),{target:{value:'S'}});
 fireEvent.change(within(modal).getByPlaceholderText('Erken değerlendirme sebebi...'),{target:{value:'Review reason'}});
 if(errors)api.post.mockImplementation(async url=>url.endsWith('generate-report')?{data:new Blob(['test'])}:{data:{successCount:0,errorCount:1,errors:[{internshipId:101,studentId:'1001',error:'Test failure'}]}});
 fireEvent.click(document.querySelector('.btn-modal-confirm'));
 await waitFor(()=>expect(gradeCall()).toBeTruthy());
 await waitFor(()=>expect(document.querySelector('.btn-modal-confirm')?.disabled ?? false).toBe(false));
 return view;
}
describe.each([['Başkan',ChairGrade],['Üye',MemberGrade]])('%s not ekranı',(_,Component)=>{
 test('Kaydet isteğinde staj IDsi bulunur',async()=>{await mount(Component);grade('Alice Test','S');fireEvent.click(screen.getByText('Tüm Notları Kaydet'));await waitFor(()=>expect(gradeCall()).toBeTruthy());expect(gradeCall()[1].grades[0].internshipId).toBe(101);});
 test('Filtre iptali kaydedilmemiş notu korur',async()=>{await mount(Component);grade('Alice Test','S');fireEvent.change(screen.getByLabelText('Puana Göre Filtrele:'),{target:{value:'all'}});expect(window.confirm).toHaveBeenCalled();expect(screen.getByLabelText('Puana Göre Filtrele:')).toHaveValue('ungraded');expect(within(screen.getByText('Alice Test').closest('tr')).getByRole('combobox')).toHaveValue('S');});
 test('Aramada gizlenen öğrencinin notu da gönderilir',async()=>{await mount(Component);grade('Alice Test','S');grade('Bob Test','U');fireEvent.change(screen.getByPlaceholderText(/Öğrenci adı veya numarası/),{target:{value:'Alice'}});fireEvent.click(screen.getByText('Tüm Notları Kaydet'));await waitFor(()=>expect(gradeCall()).toBeTruthy());expect(gradeCall()[1].grades).toHaveLength(2);});
 test('Kısmi hata mesajı başarısız öğrenciyi gösterir',async()=>{await mount(Component);grade('Alice Test','S');grade('Bob Test','U');api.post.mockResolvedValue({data:{successCount:1,errorCount:1,errors:[{internshipId:102,studentId:'1002',error:'Test failure'}]}});fireEvent.click(screen.getByText('Tüm Notları Kaydet'));await waitFor(()=>expect(document.querySelector('.toast-notification')).toBeTruthy());expect(document.querySelector('.toast-notification').textContent).toContain('Bob Test');expect(document.querySelector('.toast-notification').textContent).toContain('kaydedilemedi');});
});
test('Başkan kısmi kayıt hatasından sonra filtre uyarısını korur',async()=>{await mount(ChairGrade);grade('Alice Test','S');grade('Bob Test','U');api.post.mockResolvedValue({data:{successCount:1,errorCount:1,errors:[{internshipId:102,studentId:'1002',error:'Test failure'}]}});fireEvent.click(screen.getByText('Tüm Notları Kaydet'));await waitFor(()=>expect(document.querySelector('.toast-notification')).toBeTruthy());await waitFor(()=>expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(3));fireEvent.change(screen.getByLabelText('Puana Göre Filtrele:'),{target:{value:'all'}});expect(window.confirm).toHaveBeenCalled();});
describe.each([['Başkan',ChairEarly],['Üye',MemberEarly]])('%s erken değerlendirme',(_,Component)=>{
 test('Bir staj seçildiğinde yalnız bir satır seçilir',async()=>{await mount(Component,same);fireEvent.click(screen.getAllByRole('checkbox')[1]);expect(screen.getAllByRole('checkbox').slice(1).filter(box=>box.checked)).toHaveLength(1);});
 test('Not isteği doğru staj IDsi taşır',async()=>{await early(Component);expect(gradeCall()[1].grades[0].internshipId).toBe(101);});
 test('Not kaydı hata verince tutanak isteği gönderilmez',async()=>{await early(Component,true);expect(reportCall()).toBeUndefined();});
});
describe.each([['Başkan',ChairList],['Üye',MemberList]])('%s tutanak ekranı',(_,Component)=>{
 test('Normal tutanak isteği JSON olarak gönderilebilir',async()=>{await mount(Component);fireEvent.click(screen.getByText('Komisyon Değerlendirme Tutanağı Oluştur'));await waitFor(()=>expect(reportCall()).toBeTruthy());expect(()=>JSON.stringify(reportCall()[1])).not.toThrow();expect(reportCall()[1].includeReported??false).toBe(false);});
 test('Tutanağı yeniden oluşturma düğmesi vardır',async()=>{await mount(Component);expect(screen.getByText('Tutanağı Yeniden Oluştur')).toBeInTheDocument();});
});
