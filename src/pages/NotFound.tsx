import { useRouter } from "../router";

export default function NotFound() {
  const { navigate } = useRouter();

  return (
    <main className="screen" role="main">
      <section className="empty-state" role="status" aria-labelledby="not-found-title">
        <h1 id="not-found-title">الصفحة غير موجودة</h1>
        <p>La page demandée est introuvable.</p>
        <button type="button" className="primary" onClick={() => navigate("/")}>العودة للرئيسية · Accueil</button>
      </section>
    </main>
  );
}
