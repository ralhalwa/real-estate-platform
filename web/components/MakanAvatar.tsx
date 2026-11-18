export default function MakanAvatar({name, className='initial'}:{name?:string|null;className?:string}){
 const initials=(name||'').trim().split(/\s+/u).filter(Boolean).slice(0,2)
  .map(word=>Array.from(word)[0].toLocaleUpperCase())
  .join('');

 return <span className={className+' makan-avatar'} aria-hidden="true">{initials||'M'}</span>;
}
