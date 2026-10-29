import { stageLabels, type Application } from '../../shared/model.js';
export function Stage({ value }: { value: Application['stage'] }) {
  return (
    <span className={`badge stage-${value}`}>
      <span aria-hidden="true" />
      {stageLabels[value]}
    </span>
  );
}
