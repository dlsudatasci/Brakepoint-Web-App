// import libraries & css
import { CircularProgress, IconButton, Menu, MenuItem, ListItemIcon, Typography } from "@mui/material";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./landingSection.css";

// import icons
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import MenuIcon from '@mui/icons-material/Menu';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';





type HeaderType = "title" | "header" | "subheader";

// definition of props for EditContext
type EditContextProps = {
	anchorEl: HTMLElement;						// element to anchor to
	isOpen: boolean;							// whether this context menu is open

	onClickEditName?: () => void;				// if not undefined, enables option to edit name; triggers when this is clicked
	onClickAutoDetectRoadFeatures?: () => void;	// if not undefined, enables option to auto-detect road features from latest video
	onClickRecalibratePolygons?: () => void;	// if not undefined, enables option to recalibrate polygons; triggers when this is clicked
	onClickDeleteObject?: () => void;			// if not undefined, enables option to delete object; triggers when this is clicked
	onClose?: () => void;						// triggers when this context menu is closed, including when one of the options are clicked
}

export function EditContext({anchorEl, isOpen, onClickEditName, onClickAutoDetectRoadFeatures, onClickRecalibratePolygons, onClickDeleteObject, onClose}: EditContextProps) {
	return (
		<Menu id="header-context-menu" anchorEl={anchorEl} open={isOpen} onClose={onClose} anchorOrigin={{vertical: "top", horizontal: "right"}} >
			{onClickEditName && (
				<MenuItem onClick={ () => { onClickEditName(); onClose(); } }>
					<ListItemIcon> <EditIcon /> </ListItemIcon> Edit name
				</MenuItem>
			)}

			{onClickAutoDetectRoadFeatures && (
				<MenuItem onClick={ () => { onClickAutoDetectRoadFeatures(); onClose(); } }>
					<ListItemIcon> <AutoFixHighIcon /> </ListItemIcon> Auto-fill road feature tags
				</MenuItem>
			)}

			{onClickRecalibratePolygons && (
				< MenuItem onClick={ () => { onClickRecalibratePolygons(); onClose(); } } >
					<ListItemIcon> <HighlightAltIcon /> </ListItemIcon> Recalibrate polygons
				</MenuItem>
			)}

			{onClickDeleteObject && (
				<MenuItem onClick={ () => { onClickDeleteObject(); onClose(); } }>
					<ListItemIcon> <DeleteForeverIcon htmlColor="#bc2539" /> </ListItemIcon> <Typography color="#bc2539">Delete</Typography>
				</MenuItem>
			)}
		</Menu>
	)
}





// definition of types for the props for LandingContainer
type LandingSectionProps = {
	type: HeaderType;							// the type of the header to display 

	icon?: React.ReactNode;			// the icon to use; can be undefined
	onClickIcon?: () => void;					// function to run when the icon button is clicked (icon != undefined)

	labelHeader: string;						// the label for the header
	labelSubheader?: string;					// the label for the subheader
	chipCount?: number;							// the number to display for the chip (type == "area")

	canHide?: boolean;							// whether the contents of this section can be hidden
	startHidden?: boolean;						// whether the contents of this section is hidden on first load

	canAdd?: boolean;							// whether to create an add button
	canStartDrawing?: boolean;					// when false, deactivates the add button (replaces it with loading...)
	isAddButtonActive?: boolean;				// triggers on/off the activity status of this button, if has add button (canAdd == true)
	onClickAdd?: () => void;					// function to run when the add button is switched ON or OFF(canAdd == true)

	hasContextMenu?: boolean;					// include the context menu?
	onClickEditName?: () => void;				// if not undefined, enables option to edit name; triggers when this is clicked
	onClickAutoDetectRoadFeatures?: () => void;	// if not undefined, enables option to auto-detect road features from latest video
	onClickRecalibratePolygons?: () => void;	// if not undefined, enables option to recalibrate polygons; triggers when this is clicked
	onClickDeleteObject?: () => void;			// if not undefined, enables option to delete object; triggers when this is clicked

	children?: React.ReactNode;					// children / contents of this section that can be hidden
}

export default function LandingSection({
	type,
	icon, onClickIcon = () => {},
	labelHeader, labelSubheader, chipCount,
	canHide = false, startHidden = false,
	canAdd = false, canStartDrawing = true, isAddButtonActive = false, onClickAdd = () => {},
	hasContextMenu = false, onClickEditName, onClickAutoDetectRoadFeatures, onClickRecalibratePolygons, onClickDeleteObject,
	children
}: LandingSectionProps) {
	const [isHidden, setIsHidden] = useState(startHidden);
	
    // context menu toggles and open/close functions
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
	const handleContextMenuOpen = (event: React.PointerEvent<HTMLButtonElement>) => {
		setAnchor(event.currentTarget);
	};
	const handleContextMenuClose = () => {
		setAnchor(null);
	}

	// things that would set these variables to false regarding of whether this is actually set
	if (type == "title" || !children) { canHide = false }
	if (!onClickEditName && !onClickAutoDetectRoadFeatures && !onClickRecalibratePolygons && !onClickDeleteObject) { hasContextMenu = false }

	return (
		<div className="landingSection">
			{ /* display header for this landingSection */ }
			<div className="landingSectionHeader">
				{ /* contains the label part, include header, subheader, and area chip */ }
				<div className={"landingSectionHeaderLabel landingSectionHeader-" + type}>
					<h1>
						{labelHeader}
						{chipCount != undefined && (<div className="chip-counter">{chipCount}</div>)}
					</h1>
					{labelSubheader && ( <div> {labelSubheader} </div> )}
				</div>
				
				{ /* contains the toolbox part, including all buttons */ }
				<div className="landingSectionHeaderToolbox">
					{ icon && <IconButton onClick={ onClickIcon } > {icon} </IconButton>}

					{ /* add button for adding areas */ }
					{ canAdd && (
						<div className={ `addButton addButton-${!canStartDrawing ? "loading" : isAddButtonActive ? "active" : "inactive"}` }>
							<IconButton onClick={() => { canStartDrawing ? onClickAdd() : {} }} >
								{ !canStartDrawing ? <CircularProgress size={20} /> : isAddButtonActive ? <CloseIcon/> : <AddIcon/> }
							</IconButton>
						</div> )
					}

					{ /* context menu button for extra options (intended for a title header) */ }
					{ hasContextMenu && (
						<IconButton onClick={ (event: any) => { handleContextMenuOpen(event); } }> <MenuIcon /> </IconButton>
					)}
					
					{ /* dropdown button for hiding/showing the tabs underneath */ }
					{ canHide && ( <IconButton onClick={() => { setIsHidden(!isHidden) }}> { isHidden ? <ExpandMoreIcon /> : <ExpandLessIcon /> } </IconButton> )}
				</div>
			</div>
			
			{ /* only display contents if type != title and currently visible */ }
			{ !isHidden && ( 
				<div className="landingSectionContents">
					{ children }
				</div>
			)}

			{ /* floaty context menu only available when it is available and open */ }
			{ hasContextMenu && (
				<EditContext
					anchorEl = {anchor}
					isOpen = {Boolean(anchor)}
					onClickEditName={onClickEditName}
					onClickAutoDetectRoadFeatures={onClickAutoDetectRoadFeatures}
					onClickRecalibratePolygons={onClickRecalibratePolygons}
					onClickDeleteObject={onClickDeleteObject}
					onClose={handleContextMenuClose}
				/>
			)}
		</div>
	)
}