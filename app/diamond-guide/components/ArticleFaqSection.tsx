import type { ArticleFaq } from "@/lib/seo/article-faqs";

export default function ArticleFaqSection({
  items,
}: {
  items: readonly ArticleFaq[];
}) {
  if (items.length === 0) return null;

  return (
    <section
      className="mx-auto mt-16 max-w-[42rem] border-t border-[#e0d8cc]/75 pt-12 md:mt-20 md:pt-14"
      aria-labelledby="article-faq-heading"
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-[#6d655e]">
        Practical reference
      </p>
      <h2
        id="article-faq-heading"
        className="mt-4 text-[1.55rem] font-light leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.75rem]"
      >
        Common questions
      </h2>
      <div className="mt-7 divide-y divide-[#e0d8cc]/75 border-y border-[#e0d8cc]/75">
        {items.map((item) => (
          <details key={item.question} className="group py-5">
            <summary className="cursor-pointer list-none pr-8 text-[1rem] leading-[1.55] text-[#2f2b27] marker:hidden">
              {item.question}
            </summary>
            <p className="mt-3 max-w-[40rem] text-[0.96rem] leading-[1.82] text-[#5f5851]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
