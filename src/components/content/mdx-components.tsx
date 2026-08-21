import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { slugify } from "@/lib/text/slug";
import {
  ChecklistBox,
  DefinitionBox,
  ExampleBox,
  KeyTakeaways,
  MethodologyBox,
  ProsCons,
  QuickSummary,
  SafetyAlert,
  WarningBox,
  WhatCanChange,
} from "@/components/content/boxes";
import { OfficialSourceLink } from "@/components/content/sources";
import { ArticleImage } from "@/components/content/ArticleImage";
import { VideoEmbed } from "@/components/content/VideoEmbed";

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map((c) => textFromChildren(c)).join("");
  }
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props
  ) {
    return textFromChildren(children.props.children as ReactNode);
  }
  return "";
}

function H2(props: ComponentProps<"h2">) {
  const id = slugify(textFromChildren(props.children));
  return <h2 id={id} {...props} />;
}

function H3(props: ComponentProps<"h3">) {
  const id = slugify(textFromChildren(props.children));
  return <h3 id={id} {...props} />;
}

function Anchor({ href = "", children, ...rest }: ComponentProps<"a">) {
  const isExternal = href.startsWith("http");
  if (isExternal) {
    return (
      <a href={href} rel="noopener noreferrer external" target="_blank" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

function Table(props: ComponentProps<"table">) {
  return (
    <div className="table-wrapper">
      <table {...props} />
    </div>
  );
}

/** Componentes disponíveis dentro dos artigos MDX. */
export const mdxComponents = {
  h2: H2,
  h3: H3,
  a: Anchor,
  table: Table,
  QuickSummary,
  KeyTakeaways,
  WarningBox,
  SafetyAlert,
  DefinitionBox,
  ExampleBox,
  ProsCons,
  ChecklistBox,
  WhatCanChange,
  MethodologyBox,
  OfficialSourceLink,
  ArticleImage,
  VideoEmbed,
};
