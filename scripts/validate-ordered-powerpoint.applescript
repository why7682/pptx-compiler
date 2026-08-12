on joinValues(valuesList, delimiterText)
	set previousDelimiters to AppleScript's text item delimiters
	set AppleScript's text item delimiters to delimiterText
	set joinedText to valuesList as text
	set AppleScript's text item delimiters to previousDelimiters
	return joinedText
end joinValues

on presentationSlideCount()
	tell application "Microsoft PowerPoint"
		return count of slides of presentation 1
	end tell
end presentationSlideCount

on slideShapeCount(slidePosition)
	tell application "Microsoft PowerPoint"
		set currentSlide to slide slidePosition of presentation 1
		return count of shapes of currentSlide
	end tell
end slideShapeCount

on shapeText(slidePosition, shapePosition)
	try
		tell application "Microsoft PowerPoint"
			set currentSlide to slide slidePosition of presentation 1
			set currentShape to shape shapePosition of currentSlide
			if not (has text frame of currentShape) then return ""
			set currentTextFrame to text frame of currentShape
			if not (has text of currentTextFrame) then return ""
			return content of text range of currentTextFrame
		end tell
	on error messageText number errorNumber
		if errorNumber is -9074 then return ""
		error messageText number errorNumber
	end try
end shapeText

on closeProbePresentation(sourcePath, roundtripPath)
	tell application "Microsoft PowerPoint"
		if (count of presentations) is not 1 then return
		set openPath to full name of presentation 1
		if openPath is sourcePath or openPath is roundtripPath then close presentation 1 saving no
	end tell
end closeProbePresentation

on assertOnlyPresentation(expectedPath)
	tell application "Microsoft PowerPoint"
		if (count of presentations) is not 1 then error "PowerPoint presentation set changed during probe"
		if (full name of presentation 1) is not expectedPath then error "PowerPoint opened an unexpected presentation"
	end tell
end assertOnlyPresentation

on preparePowerPoint(applicationWasRunning)
	tell application "Microsoft PowerPoint"
		set start up dialog to false
		if not applicationWasRunning and (count of presentations) is 1 then
			set startupPresentation to presentation 1
			if (saved of startupPresentation) is false and (path of startupPresentation) is "" and (count of slides of startupPresentation) ≤ 1 then
				close startupPresentation saving no
			end if
		end if
		if (count of presentations) is not 0 then error "PowerPoint must have no user presentations open"
	end tell
end preparePowerPoint

on presentationTextInventory()
	set textSeparator to character id 31
	set slideSeparator to character id 30
	set slideRows to {}
	set slideTotal to my presentationSlideCount()
	repeat with slidePosition from 1 to slideTotal
		set shapeTexts to {}
		set shapeTotal to my slideShapeCount(slidePosition as integer)
		repeat with shapePosition from 1 to shapeTotal
			set currentText to my shapeText(slidePosition as integer, shapePosition as integer)
			if currentText is not "" then set end of shapeTexts to currentText
		end repeat
		set end of slideRows to my joinValues(shapeTexts, textSeparator)
	end repeat
	return my joinValues(slideRows, slideSeparator)
end presentationTextInventory

on run arguments
	if (count of arguments) is not 4 then error "expected four fixed file arguments"
	set sourcePath to item 1 of arguments
	set roundtripPath to item 2 of arguments
	set beforePdfPath to item 3 of arguments
	set afterPdfPath to item 4 of arguments
	repeat with filePath in {sourcePath, roundtripPath, beforePdfPath, afterPdfPath}
		if (filePath as text) does not start with "/" then error "expected absolute POSIX file arguments"
	end repeat
	set fieldSeparator to character id 29
	set applicationWasRunning to application "Microsoft PowerPoint" is running
	set probePhase to "prepare"

	try
		my preparePowerPoint(applicationWasRunning)
		set probePhase to "open-source"
		tell application "Microsoft PowerPoint"
			open (POSIX file sourcePath)
		end tell
		my assertOnlyPresentation(sourcePath)

		set probePhase to "inventory-source"
		set sourceSlideCount to my presentationSlideCount()
		set sourceTexts to my presentationTextInventory()
		set probePhase to "save-before-pdf"
		tell application "Microsoft PowerPoint"
			save presentation 1 in (POSIX file beforePdfPath) as save as PDF
			set probePhase to "save-roundtrip"
			save presentation 1 in (POSIX file roundtripPath) as save as Open XML presentation
		end tell
		my assertOnlyPresentation(roundtripPath)
		set probePhase to "close-source"
		tell application "Microsoft PowerPoint" to close presentation 1 saving no

		set probePhase to "open-roundtrip"
		tell application "Microsoft PowerPoint"
			open (POSIX file roundtripPath)
		end tell
		my assertOnlyPresentation(roundtripPath)
		set probePhase to "inventory-roundtrip"
		set reopenedSlideCount to my presentationSlideCount()
		set reopenedTexts to my presentationTextInventory()
		set probePhase to "save-after-pdf"
			tell application "Microsoft PowerPoint"
				save presentation 1 in (POSIX file afterPdfPath) as save as PDF
				set probePhase to "close-roundtrip"
				close presentation 1 saving no
				set applicationVersion to version
			end tell
	on error messageText number errorNumber
		my closeProbePresentation(sourcePath, roundtripPath)
		error (probePhase & ": " & messageText) number errorNumber
	end try

	return my joinValues({applicationVersion, sourceSlideCount as text, reopenedSlideCount as text, sourceTexts, reopenedTexts}, fieldSeparator)
end run
