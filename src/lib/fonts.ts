import { Bricolage_Grotesque } from "next/font/google";

// Fonte de titulos do site da loja (marca, secoes do cardapio, nomes de pratos).
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});
