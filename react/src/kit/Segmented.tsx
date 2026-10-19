import { Fragment, useId } from "react";

export interface SegOption<T extends string | number> { value: T; label: string }

/** A row of radio buttons drawn as one segmented control. */
export function Segmented<T extends string | number>(props: {
  options: SegOption<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string; title?: string;
}) {
  const name = useId();
  return (
    <div className={`seg ${props.className ?? ""}`} role="radiogroup" aria-label={props.label} title={props.title}>
      {props.options.map(o => {
        const id = `${name}-${o.value}`;
        return (
          <Fragment key={String(o.value)}>
            <input type="radio" id={id} name={name} checked={o.value === props.value} onChange={() => props.onChange(o.value)} />
            <label htmlFor={id}>{o.label}</label>
          </Fragment>
        );
      })}
    </div>
  );
}
