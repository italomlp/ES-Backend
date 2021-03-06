const sanitize = require('mongo-sanitize');
const validator = require('validator');
let MileageController = require('./mileage');

module.exports = (app) => {
  const Car = app.models.car;
  // const MileageController = app.controllers.mileage;
  MileageController = MileageController(app);

  const controller = {};

  const CAR_PROJECTION = 'owner brand model year plate odometer';

  const validateCar = (updating, {
    brand, plate, model, year, odometer
  }) => {
    let isValid = true;
    isValid =
      brand && isValid ? !validator.isEmpty(brand.trim()) : isValid && updating;
    isValid =
      plate && isValid
        ? plate.length === 8 && validator.matches(plate, /[a-zA-Z]{3}-[\d]{4}/)
        : isValid && updating;
    isValid =
      model && isValid ? !validator.isEmpty(model.trim()) : isValid && updating;
    isValid = year && isValid ? year.length === 4 : isValid && updating;
    isValid = odometer != null && isValid ? odometer >= 0 : isValid && updating;
    return isValid;
  };

  // Display all cars on GET.
  controller.list = (req, res) => {
    const owner = req.user._id;
    Car.find({ owner }, CAR_PROJECTION)
      .exec()
      .then((cars) => res.status(200).json(cars))
      .catch((error) => {
        console.log('Error:', error);
        return res.status(500).end();
      });
  };

  // Display detail page for a specific car on GET.
  controller.get = (req, res) => {
    const _id = sanitize(req.params.id);
    const owner = req.user._id;
    Car.findOne({ _id, owner }, CAR_PROJECTION)
      .lean(true)
      .exec()
      .then((car) => res.status(200).json(car))
      .catch((error) => {
        console.log('Error:', error);
        return res.status(500).json(error);
      });
  };

  // Handle car create on POST.
  controller.add = (req, res) => {
    const owner = req.user._id;
    const {
      brand, model, year, plate, odometer
    } = req.body;

    if (
      !validateCar(false, {
        brand,
        model,
        year,
        plate,
        odometer
      })
    ) {
      return res.status(500).json(new Error('Invalid car.'));
    }

    const newCar = new Car({
      owner,
      brand,
      model,
      year,
      plate,
      odometer
    });

    newCar
      .save()
      .then(async (car) => {
        try {
          await MileageController.add(car._id, car.owner, {
            kilometers: odometer
          });
          return res.status(200).json(car);
        } catch (error) {
          console.log(error);
          await Car.remove({ _id: car._id }).exec();
          return res.status(500).json('Impossible add car.');
        }
      })
      .catch((error) => {
        console.log('Error:', error);
        return res.status(500).json(error);
      });
  };

  // Display car update form on PUT.
  controller.update = (req, res) => {
    const owner = req.user._id;
    const data = {};
    if (req.body.brand) data.brand = req.body.brand;
    if (req.body.model) data.model = req.body.model;
    if (req.body.year) data.year = req.body.year;
    if (req.body.plate) data.plate = req.body.plate;
    if (req.body.odometer) data.odometer = req.body.odometer;

    if (!validateCar(true, data)) {
      return res.status(500).json(new Error('Invalid car.'));
    }

    const _id = sanitize(req.params.id);

    Car.findOneAndUpdate({ _id, owner }, data, { new: true })
      .lean(true)
      .exec()
      .then(async (car) => {
        if (req.body.odometer) {
          try {
            await MileageController.add(car._id, car.owner, {
              kilometers: req.body.odometer
            });
            return res.status(200).json(car);
          } catch (error) {
            console.log('Error:', error);
            return res.status(500).json(error);
          }
        } else {
          return res.status(200).json(car);
        }
      })
      .catch((error) => {
        console.log('Error:', error);
        return res.status(500).json(error);
      });
  };

  // Handle car delete on DELETE.
  controller.delete = (req, res) => {
    const _id = sanitize(req.params.id);
    const owner = req.user._id;
    Car.findOneAndDelete({ _id, owner })
      .exec()
      .then(() => res.status(200).end())
      .catch((error) => {
        console.log('Error:', error);
        return res.status(500).json(error);
      });
  };

  return controller;
};
