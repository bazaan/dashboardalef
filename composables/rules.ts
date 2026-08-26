export const useFormRules = () => {
	return {
		ruleRequired: (v: any) => !!v || "Required",
		ruleEmail: (value: any) => {
			const pattern =
				/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
			return pattern.test(value) || "Enter a valid email";
		},
		rulePassLen: (v: string) => (!!v && v.length >= 6) || "Password must be 6 chars or more",
		/**
		 * RUC peruano: exactamente 11 dígitos.
		 *
		 * Solo valida el formato, no el dígito verificador ni la existencia en
		 * SUNAT: para eso haría falta consultar su padrón.
		 */
		ruleRuc: (v: any) =>
			/^\d{11}$/.test(String(v ?? "").trim()) || "El RUC debe tener 11 dígitos",
	};
};

/** Misma regla que `ruleRuc`, para usar fuera de un componente (servidor incluido). */
export const esRucValido = (v: any): boolean => /^\d{11}$/.test(String(v ?? "").trim());
