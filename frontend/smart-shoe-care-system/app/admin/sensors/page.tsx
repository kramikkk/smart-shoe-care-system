import SensCard from "@/components/SensCard"

const SensorsPage = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4">
      <SensCard id="temperature"/>
      <SensCard id="humidity"/>
      <SensCard id="atomizerLevel"/>
      <SensCard id="uvLamp"/>
    </div>
  )
}

export default SensorsPage