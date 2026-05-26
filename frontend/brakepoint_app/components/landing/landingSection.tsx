// import libraries & css
import { IconButton } from "@mui/material";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./landingSection.css";

// import icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import EditIcon from '@mui/icons-material/Edit';



type HeaderType = "title" | "header" | "subheader";

// definition of types for the props for LandingContainer
type LandingSectionProps = {
	type: HeaderType;					// the type of the header to display 
	icon?: React.ReactNode;				// the icon to use; can be undefined

	labelHeader: string;				// the label for the header
	labelSubheader?: string;			// the label for the subheader
	chipCount?: number;					// the number to display for the chip (type == "area")

	canHide?: boolean;					// whether the contents of this section can be hidden
	startHidden?: boolean;				// whether the contents of this section is hidden on first load

	onClickIcon?: () => void;			// function to run when the icon button is clicked (icon != undefined)
	children?: React.ReactNode;			// children / contents of this section that can be hidden
}

// controls whether this section is hidden


export default function LandingSection({ type, icon, labelHeader, labelSubheader, chipCount, canHide = false, startHidden = false, onClickIcon = () => {}, children }: LandingSectionProps) {
	const [isHidden, setIsHidden] = useState(startHidden);

	// things that would set canHide to false regarding of whether this is actually set
	if (type == "title" || !children) { canHide = false }

	return (
		<div className="landingSection">
			{ /* display header for this landingSection */ }
			<div className="landingSectionHeader">
				{ /* contains the label part, include header, subheader, and area chip */ }
				<div className={"landingSectionHeaderLabel landingSectionHeader-" + type}>
					<h1>
						{labelHeader}
						{chipCount && (<div className="chip-counter">{chipCount}</div>)}
					</h1>
					{labelSubheader && ( <div> {labelSubheader} </div> )}
				</div>
				
				{ /* contains the toolbox part, including all buttons */ }
				<div className="landingSectionHeaderToolbox">
					{ icon && <IconButton onClick={ onClickIcon } > {icon} </IconButton>}

					{ /* dropdown button for hiding/showing the tabs underneath */ }
					{ canHide && !isHidden && ( <IconButton onClick={() => {setIsHidden(true)}}> <ArrowDropUpIcon /> </IconButton> )}
					{ canHide && isHidden && ( <IconButton onClick={() => {setIsHidden(false)}}> <ArrowDropDownIcon /> </IconButton> )}
				</div>
			</div>
			
			{ /* only display contents if type != title and currently visible */ }
			{ !isHidden && ( 
				<div className="landingSectionContents">
					{ children }
				</div>
			)}
		</div>
	)
}