import { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Valores sugeridos no datalist — o operador também pode digitar livre. */
  suggestions: string[];
  /** id único do <datalist> (precisa ser único na página). */
  listId: string;
};

/**
 * Input "select com opção de digitar": mostra sugestões via <datalist> mas
 * aceita qualquer texto. forwardRef para casar com o register do react-hook-form
 * (spread `{...register("campo")}` roteia name/onChange/onBlur/ref).
 */
export const SuggestInput = forwardRef<HTMLInputElement, Props>(
  function SuggestInput({ suggestions, listId, ...props }, ref) {
    return (
      <>
        <input ref={ref} list={listId} {...props} />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </>
    );
  },
);
