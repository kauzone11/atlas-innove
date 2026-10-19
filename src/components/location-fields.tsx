"use client";

import { useId, useState } from "react";
import { brazilianStateNames, brazilianStates, municipalitiesOfState } from "@/lib/geo/localities";

export function LocationFields({ defaultState, defaultCity, disabled = false }: { defaultState?: string | null; defaultCity?: string | null; disabled?: boolean }) {
  const stateId = useId();
  const cityId = useId();
  const [state, setState] = useState(defaultState ?? "");
  const [city, setCity] = useState(defaultCity ?? "");
  const municipalities = municipalitiesOfState(state);
  const stateOptions = state && !brazilianStateNames.includes(state) ? [state, ...brazilianStateNames] : brazilianStateNames;
  const cityOptions = city && state && !municipalities.includes(city) ? [city, ...municipalities] : municipalities;
  return <>
    <label htmlFor={stateId} className="block space-y-2 text-sm font-medium">
      <span>Estado</span>
      <select id={stateId} className="field-control" name="state" value={state} disabled={disabled} onChange={(event) => { setState(event.target.value); setCity(""); }}>
        <option value="">Selecione um estado</option>
        {stateOptions.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
    <label htmlFor={cityId} className="block space-y-2 text-sm font-medium">
      <span>Cidade</span>
      <select id={cityId} className="field-control" name="city" value={city} disabled={disabled || !state} onChange={(event) => setCity(event.target.value)}>
        <option value="">{state ? "Selecione um município" : "Escolha o estado primeiro"}</option>
        {cityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  </>;
}

export function StateSelect({ name, defaultValue, id }: { name: string; defaultValue?: string | null; id?: string }) {
  const known = !defaultValue || brazilianStates.some((state) => state.name === defaultValue);
  return <select id={id} className="field-control" name={name} defaultValue={defaultValue ?? ""}>
    <option value="">Todos os estados</option>
    {!known ? <option value={defaultValue ?? ""}>{defaultValue}</option> : null}
    {brazilianStates.map((state) => <option key={state.uf} value={state.name}>{state.name}</option>)}
  </select>;
}
