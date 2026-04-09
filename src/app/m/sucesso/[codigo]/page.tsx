"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function PedidoSucessoPage() {
  const params = useParams();
  const codigo = params?.codigo as string;

  return (
    <main className="min-h-screen bg-[#f8eeee] px-4 py-6">
      <div className="mx-auto flex min-h-[88vh] max-w-md items-center justify-center">
        <section className="w-full max-w-[320px] rounded-[30px] border border-[#e9dedd] bg-white px-5 py-7 text-center shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
          
          <div className="mx-auto flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[#dcf8e8]">
            <span className="text-[38px] font-bold leading-none text-[#12b76a]">
              ✓
            </span>
          </div>

          <h1 className="mt-5 text-[18px] font-black text-[#202020]">
            Pedido enviado!
          </h1>

          <p className="mt-1 text-[12px] font-semibold text-[#7b7b7b]">
            Recebemos seu pedido com sucesso.
          </p>

          <div className="mt-5 rounded-[16px] bg-[#f3f2f4] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a9a9a]">
              Número do pedido
            </p>

            <p className="mt-2 text-[27px] font-black leading-none text-[#ff1010]">
              #{codigo}
            </p>
          </div>

          <p className="mx-auto mt-5 max-w-[230px] text-[13px] font-semibold leading-5 text-[#7b7b7b]">
            Você poderá acompanhar o status do pedido no app.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href={`/m/s/${codigo}`}
              className="flex h-[48px] w-full items-center justify-center rounded-full bg-[#ff1010] text-[14px] font-black text-white shadow-sm"
            >
              Acompanhar pedido
            </Link>

            <Link
              href="/m"
              className="flex h-[48px] w-full items-center justify-center rounded-full border border-[#eadfda] bg-white text-[14px] font-black text-[#5d5d5d]"
            >
              Voltar para o app
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
