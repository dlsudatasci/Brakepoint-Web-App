"use client";

import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import LocationCard from "./locationCard";
import type { SubAreaSummary } from "./analytics";

import "./cardCarousel.css";

// definition of types for the props for CardCarousel
type CarouselProps = {
  subareas: SubAreaSummary[];                   // array of all subareas to be used, each subarea becomes a new card
  onSelect?: (subarea: SubAreaSummary) => void; // function to trigger when a card is selected
  emptyTitle?: string;                          // title to display when the card carousel is empty
  emptyDescription?: string;                    // description to display when the card carousel is empty
  emptyRoute?: string;                          // route to go to when the card cariousel is empty
};

// CardCarousel - lists out all subareas in this card carousel (if there are subareas)
export default function CardCarousel({
  subareas,
  onSelect,
  emptyTitle = "No Sub-Areas Yet",
  emptyDescription = "Switch to Configuration mode and draw a sub-area to begin.",
  emptyRoute = "/explore",
}: CarouselProps) {
  const router = useRouter();
  const isEmpty = subareas.length === 0;

  // go to emptyRoute when user clicks while this card carousel is empty
  const handleEmptyClick = useCallback(() => {
    router.push(emptyRoute);
  }, [router, emptyRoute]);

  // go to emptyRoute when user presses certain keys while this card carousel is empty
  const handleEmptyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEmptyClick();
      }
    },
    [handleEmptyClick],
  );

  return (
    <Box className={`carousel-container ${isEmpty ? "carousel-container--empty" : ""}`}>
      {isEmpty ? (

        <Box className="carousel-empty-wrapper">
          {/* empty card carousel placeholder - display guidance text on where the user can proceed next */}
          <Box
            className="carousel-empty"
            role="button"
            tabIndex={0}
            onClick={handleEmptyClick}
            onKeyDown={handleEmptyKeyDown}
          >
            <Typography variant="h4" className="carousel-empty__title">
              {emptyTitle}
            </Typography>

            <Typography variant="body1" className="carousel-empty__description">
              {emptyDescription}
            </Typography>
          </Box>
        </Box>

      ) : (
        subareas.map((subarea) => (
          <Box className="carousel-card-container" key={subarea.id}>
            {/* for each subarea we have (subareas.map), create a new LocationCard */}
            <LocationCard camera={subarea} onClick={() => onSelect?.(subarea)} />
          </Box>
        ))
      )}
    </Box>
  );
}