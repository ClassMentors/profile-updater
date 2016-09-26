'use strict';

const expect = require('./chai').expect;
const sinon = require('./chai').sinon;
const servicesModule = require('../src/services');

describe('services', function() {
  let services, firebaseApp, pivotalFirebaseApp, http;

  beforeEach(function() {
    firebaseApp = {database: sinon.stub()};
    pivotalFirebaseApp = {database: sinon.stub()};
    http = {get: sinon.stub()};

    services = servicesModule.factory(firebaseApp, pivotalFirebaseApp, http);
  });

  describe('codeCombat', function() {
    let db, dataRef, detailsRef, snapshot, profileData;

    beforeEach(function() {
      db = {ref: sinon.stub()};
      firebaseApp.database.returns(db);

      dataRef = {child: sinon.stub(), update: sinon.stub()};
      db.ref.withArgs('classMentors/userProfiles/bob/services/codeCombat').returns(dataRef);

      detailsRef = {once: sinon.stub()};
      dataRef.child.withArgs('details').returns(detailsRef);
      dataRef.update.returns(Promise.resolve());

      snapshot = {val: sinon.stub()};
      detailsRef.once.returns(Promise.resolve(snapshot));

      snapshot.val.returns({id: 'codecombat:bob'});

      profileData = [];
      http.get.returns(Promise.resolve({data: profileData}));
    });

    describe('updateAchievements', function() {

      it('should fetch the user\'s codeCombat details', function() {
        return services.codeCombat.updateAchievements('bob').then(() => {
          expect(detailsRef.once).to.have.been.calledOnce();
          expect(detailsRef.once).to.have.been.calledWith('value');
        });
      });

      it('should fetch the code combat profile', function() {
        return services.codeCombat.updateAchievements('bob').then(() => {
          expect(http.get).to.have.been.calledOnce();
          expect(http.get).to.have.been.calledWith('https://codecombat.com/db/user/codecombat:bob/level.sessions?project=state.complete,levelID,levelName');
        });
      });

      it('should update the user code combat data', function() {
        profileData.push({
          state: {complete: false},
          levelID: 'level1',
          name: 'some name'
        }, {
          state: {complete: true},
          levelID: 'level2',
          name: 'some other name'
        });

        return services.codeCombat.updateAchievements('bob').then(() => {
          expect(dataRef.update).to.have.been.calledOnce();
          expect(dataRef.update).to.have.been.calledWithExactly(sinon.match.object);

          const patch = dataRef.update.lastCall.args[0];

          expect(patch).to.eql({
            totalAchievements: 1,
            achievements: {
              level2: {
                levelID: 'level2',
                name: 'some other name',
                state: {complete: true}
              }
            },
            lastUpdate: {'.sv': 'timestamp'}
          });
        });
      });

    });

  });

});
