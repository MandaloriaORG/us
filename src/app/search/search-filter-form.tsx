import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/origin/native-select";
import { SearchInput } from "@/components/origin/search-input";
import { TextInput } from "@/components/origin/text-input";
import {
  searchEntityTypes,
  type SearchFilterField,
  type SearchFilterValues,
  type SearchPlazaOption,
} from "@/lib/search";

const entityLabels: Readonly<Record<string, string>> = {
  article: "Articles",
  comment: "Comments",
  post: "Posts",
};

export interface SearchFilterFormProps {
  errors: Partial<Record<SearchFilterField, string>>;
  plazas: ReadonlyArray<SearchPlazaOption>;
  values: SearchFilterValues;
}

/**
 * URL-driven search form. Every control is uncontrolled and named after the
 * search parameter it owns, so submitting GETs `/search?...` and the back
 * button restores the exact filters. The server validates and re-renders with
 * inline errors when a hand-edited URL is invalid.
 */
export function SearchFilterForm({ errors, plazas, values }: SearchFilterFormProps) {
  return (
    <form
      action="/search"
      className="border-border mt-6 grid gap-4 border-y py-4 md:grid-cols-2 2xl:grid-cols-[minmax(16rem,1fr)_10rem_12rem_11rem_12rem_auto] 2xl:items-end"
      method="get"
    >
      <SearchInput
        autoComplete="off"
        defaultValue={values.q}
        error={errors.q}
        fieldClassName="md:col-span-2 2xl:col-span-1"
        id="search-q"
        label="Search"
        maxLength={200}
        name="q"
        placeholder="Posts, comments, Codex articles…"
        spellCheck={false}
      />

      <NativeSelect
        defaultValue={values.type}
        error={errors.type}
        id="search-type"
        label="Content"
        name="type"
      >
        <option value="">Everything</option>
        {searchEntityTypes.map((type) => (
          <option key={type} value={type}>
            {entityLabels[type]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        defaultValue={values.plaza}
        error={errors.plaza}
        id="search-plaza"
        label="Plaza"
        name="plaza"
      >
        <option value="">All Plazas</option>
        {plazas.map((plaza) => (
          <option key={plaza.id} value={plaza.slug}>
            {plaza.name}
          </option>
        ))}
      </NativeSelect>

      <TextInput
        autoComplete="off"
        defaultValue={values.tag}
        error={errors.tag}
        id="search-tag"
        label="Tag"
        name="tag"
        placeholder="e.g. mandalore"
        spellCheck={false}
      />

      <TextInput
        autoComplete="off"
        defaultValue={values.author}
        error={errors.author}
        id="search-author"
        label="Author ID"
        name="author"
        placeholder="UUID"
        spellCheck={false}
      />

      <Button className="px-4" type="submit">
        Search
      </Button>

      {errors.page ? (
        <p className="text-error text-xs md:col-span-2 2xl:col-span-full" role="alert">
          Page: {errors.page}
        </p>
      ) : null}
    </form>
  );
}
