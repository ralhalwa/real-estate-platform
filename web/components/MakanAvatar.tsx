type AvatarRole='admin'|'manager'|'agent'|'staff'|'customer';

export default function MakanAvatar({name, className='initial',role='customer'}:{name?:string|null;className?:string;role?:AvatarRole}){
 const initials=(name||'').trim().split(/\s+/u).filter(Boolean).slice(0,2)
  .map(word=>Array.from(word)[0].toLocaleUpperCase())
  .join('');

 return <span className={className+' makan-avatar'} data-avatar-role={role} aria-hidden="true">{initials||'M'}</span>;
}
