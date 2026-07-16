-- Forward-only DATA migration. Only unambiguous single-region deck membership is copied.

with unambiguous_place_regions as (
  select
    deck_places.place_id,
    min(decks.region_id) as region_id
  from public.deck_places
  join public.decks on decks.id = deck_places.deck_id
  group by deck_places.place_id
  having count(distinct decks.region_id) = 1
)
update public.places
set region_id = unambiguous_place_regions.region_id
from unambiguous_place_regions
where places.id = unambiguous_place_regions.place_id
  and places.region_id is null;
