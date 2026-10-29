import { Icon } from '../components/Icon.js';
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Icon name="folder" size={28} />
      <h3>Room for the next step.</h3>
      <p>{text}</p>
    </div>
  );
}
