// @flow

import React, { useState, useEffect, useMemo } from "react"
import { makeStyles } from "@material-ui/core/styles"
import Annotator from "react-image-annotate"
import isEqual from "lodash/isEqual"
import useEventCallback from "use-event-callback"

const useStyles = makeStyles({})

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomColor() {
  var h = getRandomInt(0, 360)
  var s = 100
  var l = 50
  return "hsl("
    .concat(h, ",")
    .concat(s, "%,")
    .concat(l, "%)")
}

const rid = () =>
  Math.random()
    .toString()
    .split(".")[1]

const convertToRIARegionFmt = region => {
  switch (region.regionType) {
    case "bounding-box": {
      return {
        id: rid(),
        cls: region.classification,
        tags: region.labels,
        color: region.color || getRandomColor(),
        type: "box",
        x: region.centerX - region.width / 2,
        y: region.centerY - region.height / 2,
        w: region.width,
        h: region.height
      }
    }
    case "point": {
      return {
        id: rid(),
        type: "point",
        tags: region.labels,
        cls: region.classification,
        color: region.color || getRandomColor(),
        x: region.x,
        y: region.y
      }
    }
    case "polygon": {
      return {
        id: rid(),
        type: "polygon",
        tags: region.labels,
        cls: region.classification,
        color: region.color || getRandomColor(),
        open: false,
        points: region.points.map(p => [p.x, p.y])
      }
    }
    case "line":
    case "pixel-mask": {
      throw new Error(`Unsupported region "${JSON.stringify(region)}"`)
    }
  }
}

const convertFromRIARegionFmt = riaRegion => {
  switch (riaRegion.type) {
    case "point": {
      return {
        regionType: "point",
        x: riaRegion.x,
        y: riaRegion.y,
        classification: riaRegion.cls,
        labels: riaRegion.tags,
        color: riaRegion.color
      }
    }
    case "box": {
      return {
        regionType: "bounding-box",
        centerX: riaRegion.x + riaRegion.w / 2,
        centerY: riaRegion.y + riaRegion.h / 2,
        width: riaRegion.w,
        height: riaRegion.h,
        classification: riaRegion.cls,
        labels: riaRegion.tags,
        color: riaRegion.color
      }
    }
    case "polygon": {
      return {
        regionType: "polygon",
        classification: riaRegion.cls,
        labels: riaRegion.tags,
        color: riaRegion.color,
        points: riaRegion.points.map(([x, y]) => ({ x, y }))
      }
    }
  }
  throw new Error(`Unsupported riaRegion "${JSON.stringify(riaRegion)}"`)
}

const convertToRIAImageFmt = ({ title, taskDatum: td, index: i, output }) => {
  if ((td || {}).imageUrl) {
    return {
      src: td.imageUrl,
      name: title || `Sample ${i}`,
      regions: !output
        ? undefined
        : Array.isArray(output)
        ? output.map(convertToRIARegionFmt)
        : [convertToRIARegionFmt(output)]
    }
  }
  throw new Error(`Task Datum not supported "${JSON.stringify(td)}"`)
}

const regionTypeToTool = {
  "bounding-box": "create-box",
  polygon: "create-polygon",
  "full-segmentation": "create-polygon",
  point: "create-point"
}

const [emptyObj, emptyArr] = [{}, []]

export default ({
  interface: iface,
  taskData = emptyArr,
  taskOutput = emptyObj,
  containerProps = emptyObj,
  onSaveTaskOutputItem
}) => {
  const c = useStyles()
  const [selectedIndex, changeSelectedIndex] = useState(0)

  const { regionTypesAllowed = ["bounding-box"] } = iface

  const isClassification = !Boolean(iface.multipleRegionLabels)

  const labelProps = useMemo(
    () =>
      isClassification
        ? {
            regionClsList: (iface.availableLabels || []).map(l =>
              typeof l === "string" ? l : l.id
            )
          }
        : {
            regionTagList: (iface.availableLabels || []).map(l =>
              typeof l === "string" ? l : l.id
            )
          },
    [isClassification]
  )

  const multipleRegions =
    iface.multipleRegions || iface.multipleRegions === undefined

  const onExit = useEventCallback(output => {
    const regionMat = (output.images || [])
      .map(img => img.regions)
      .map(riaRegions => (riaRegions || []).map(convertFromRIARegionFmt))

    for (let i = 0; i < regionMat.length; i++) {
      if (multipleRegions) {
        onSaveTaskOutputItem(i, regionMat[i])
      } else {
        onSaveTaskOutputItem(i, regionMat[i][0])
      }
    }
    if (containerProps.onExit) containerProps.onExit()
  })

  const images = useMemo(
    () =>
      taskData.map((taskDatum, index) =>
        convertToRIAImageFmt({
          title: containerProps.datasetName,
          taskDatum,
          output: taskOutput[index],
          index
        })
      ),
    [taskData]
  )

  const enabledTools = useMemo(
    () =>
      ["select"].concat(
        regionTypesAllowed.map(rt => regionTypeToTool[rt]).filter(Boolean)
      ),
    [regionTypesAllowed]
  )

  return (
    <div style={{ height: "calc(100vh - 70px)" }}>
      <Annotator
        selectedImage={taskData[selectedIndex].src}
        taskDescription={iface.description}
        {...labelProps}
        enabledTools={enabledTools}
        images={images}
        onExit={onExit}
      />
    </div>
  )
}
