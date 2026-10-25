import {Building2,CheckCircle2} from 'lucide-react';
import type {Office,OfficeMember,Language} from '@/lib/model';

export default function AccountAffiliations({members,offices,lang}:{members:OfficeMember[];offices:Office[];lang:Language}){
 const t=(ar:string,en:string)=>lang==='ar'?ar:en;
 return <section className="profile-office-section" aria-labelledby="profile-office-title"><div className="profile-section-title"><Building2 size={19}/><h2 id="profile-office-title">{t('المكتب والفريق','Office & team')}</h2></div>
 {members.length?<div className="profile-office-list">{members.map(member=>{const office=offices.find(o=>o.id===member.office_id);return <article className={'profile-office-item profile-office-role-'+member.office_role} key={member.office_id}><div className="profile-office-icon"><Building2 size={22}/></div><div className="profile-office-info"><h3>{office?.name||t('مكتب مُعيّن','Assigned office')}{office?.verification_status==='verified'&&<CheckCircle2 size={15} aria-label={t('مكتب موثّق','Verified office')}/>}</h3><p>{member.office_role==='manager'?t('مدير المكتب','Office manager'):member.office_role==='staff'?t('موظف مكتب','Office staff'):t('وكيل المكتب','Office agent')}</p>{!office&&<small>{t('تفاصيل المكتب غير متاحة حالياً','Office details currently unavailable')}</small>}{office&&office.account_status!=='active'&&<small>{t('المكتب موقوف','Office suspended')}</small>}</div>{member.membership_status!=='active'&&<span className="profile-membership-note">{t('عضوية غير نشطة','Inactive membership')}</span>}</article>})}</div>:<p className="profile-office-empty">{t('لم تنضم إلى مكتب بعد.','No office connected yet.')}</p>}
 </section>;
}
