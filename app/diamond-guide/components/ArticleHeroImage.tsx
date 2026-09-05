import Image from "next/image";
import type { Article } from "../articles";
import {
  resolveArticleHeroImage,
} from "@/lib/diamond-guide/article-imagery";

type ArticleHeroImageProps = {
  article: Article;
};

export default function ArticleHeroImage({ article }: ArticleHeroImageProps) {
  const hero = resolveArticleHeroImage(article);

  if (!hero) {
    return null;
  }

  return (
    <figure className="mx-auto mt-12 max-w-[42rem] md:mt-14">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-[#e0d8cc]/85 bg-[#faf6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-cover"
          style={{ objectPosition: "center" }}
        />
      </div>
      {hero.caption ? (
        <figcaption className="mt-4 px-1 text-center text-[0.86rem] leading-[1.74] text-hg-muted">
          {hero.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
