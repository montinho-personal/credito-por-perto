"use client";

/**
 * Abre a pergunta apontada pelo endereço.
 *
 * Cada pergunta tem id próprio, então `/artigo/#existe-banco-do-povo` é um
 * link legítimo — de outra página do portal, de uma busca, de uma conversa.
 * Sem isto, esse link levaria a pessoa até um acordeão fechado, e ela teria
 * de descobrir sozinha qual das perguntas era a certa.
 *
 * Os navegadores estão começando a fazer isso sozinhos, mas só quando o alvo
 * está DENTRO do `<details>` — aqui o id é do próprio elemento — e nem todos
 * já suportam. São dez linhas que valem por não deixar um link publicado
 * chegar a lugar nenhum.
 */
import { useEffect } from "react";

export function FaqHashOpener() {
  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const target = document.getElementById(decodeURIComponent(hash));
      /* `closest` cobre os dois casos: o id do próprio <details> e um id de
         algo que esteja dentro da resposta. */
      const details = target?.closest("details");
      if (!details || details.open) return;
      details.open = true;
      details.scrollIntoView({ block: "start" });
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
